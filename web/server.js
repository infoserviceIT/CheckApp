// CheckApp web portal — anonymous upload-and-scan, no accounts, no storage.
//
// This is intentionally a thin HTTP wrapper: all the actual inspection/rule
// logic lives in ../src and is unchanged from the CLI. If you're looking for
// "how does checkapp decide pass/fail", you want ../src/rules, not this file.
//
// Privacy stance (reflected in the UI copy too, keep them in sync): an
// uploaded build is written to a temp file only for the duration of one
// scan, then deleted — in the request's `finally` block, and again by a
// periodic sweep below as a safety net. Nothing uploaded here is retained.

import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync, statSync, unlink } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  inspectAndroidBundle,
  checkBundletoolAvailable,
  BundletoolNotFoundError,
} from '../src/inspectors/android-bundletool.js';
import { runRules } from '../src/rules/index.js';
import { summarize } from '../src/report/format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const MAX_UPLOAD_BYTES = 300 * 1024 * 1024; // 300MB — generous for a real .aab, not unlimited
const STALE_FILE_MAX_AGE_MS = 10 * 60 * 1000; // safety-net sweep, see below

const UPLOAD_DIR = path.join(tmpdir(), 'checkapp-uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));

// This endpoint spends real CPU (a JVM invocation) per request and is
// reachable anonymously — rate-limit it defensively. These numbers are a
// starting point, not a promise: tune once you've seen real traffic.
const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe scansioni da questo indirizzo di recente — riprova tra qualche minuto.' },
});

// multer MUST be >= 2.2.0 here: 1.x and early 2.x-alpha releases carry two
// real CVEs that matter a lot for exactly this endpoint (anonymous public
// upload) — CVE-2026-5079 (DoS via deeply-nested multipart field names) and
// CVE-2026-5038 (disk-space exhaustion: aborted uploads under diskStorage
// weren't always cleaned up). Both are fixed in 2.2.0+. Don't "helpfully"
// downgrade this to match an older multer tutorial you find online.
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.aab`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    // Extension check only — a cheap early rejection. The real validation is
    // bundletool actually parsing the thing as a zip/AAB a few lines down;
    // this filter just avoids wasting a JVM invocation on an obvious mismatch.
    if (!file.originalname.toLowerCase().endsWith('.aab')) {
      cb(new Error('Solo file .aab sono supportati in questa fase (Android, Fase 1).'));
      return;
    }
    cb(null, true);
  },
}).single('file');

app.post('/api/scan', scanLimiter, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      const isTooBig = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
      res.status(isTooBig ? 413 : 400).json({
        error: isTooBig
          ? `File troppo grande (limite: ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB).`
          : err.message || 'Upload non valido.',
      });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Nessun file ricevuto (campo atteso: "file").' });
      return;
    }

    try {
      const data = inspectAndroidBundle(req.file.path);
      const findings = runRules('android', data);
      res.json({ summary: summarize(findings), findings });
    } catch (e) {
      if (e instanceof BundletoolNotFoundError) {
        // Server misconfiguration, not the user's fault — don't blame their file.
        console.error('bundletool non è configurato correttamente sul server:', e.message);
        res.status(500).json({
          error: 'Il servizio non è configurato correttamente lato server. Riprova più tardi o segnala il problema.',
        });
        return;
      }
      res.status(422).json({ error: `Non è stato possibile leggere il bundle: ${e.message}` });
    } finally {
      // Privacy: never retain an uploaded build beyond the single scan that
      // needed it, success or failure.
      unlink(req.file.path, () => {});
    }
  });
});

// Confirms the one thing that actually needs to be true for this service to
// work at all (Java + bundletool reachable) — point your platform's health
// check here, not at "/", so a misconfigured deploy is caught immediately
// instead of on someone's first real scan.
app.get('/healthz', (req, res) => {
  const check = checkBundletoolAvailable();
  res.status(check.ok ? 200 : 503).json(check);
});

// Safety-net sweep: multer 2.2+ and the per-request `finally` above should
// already delete every upload, but a process crash mid-request could still
// leave an orphan behind. Belt and suspenders for a service that's supposed
// to retain nothing.
setInterval(() => {
  const cutoff = Date.now() - STALE_FILE_MAX_AGE_MS;
  for (const name of readdirSync(UPLOAD_DIR)) {
    const filePath = path.join(UPLOAD_DIR, name);
    try {
      if (statSync(filePath).mtimeMs < cutoff) unlink(filePath, () => {});
    } catch {
      // file already gone between readdir and stat — fine, that's the goal.
    }
  }
}, 5 * 60 * 1000).unref();

app.listen(PORT, () => {
  const check = checkBundletoolAvailable();
  if (check.ok) {
    console.log(`checkapp-web listening on :${PORT} (bundletool ${check.version})`);
  } else {
    console.error(
      `checkapp-web listening on :${PORT}, but bundletool is NOT reachable — every scan will ` +
        `fail until this is fixed: ${check.error}`
    );
  }
});
