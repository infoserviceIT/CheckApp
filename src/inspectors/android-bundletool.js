// Extracts structured manifest data from a real .aab by shelling out to
// Google's own `bundletool` (https://github.com/google/bundletool).
//
// Why bundletool and not a hand-rolled AAB/AXML parser: an Android App
// Bundle stores AndroidManifest.xml in a binary format (compiled XML or
// protobuf, depending on the aapt2 version used to build it). Re-implementing
// that parser is real work and an easy place to get subtly wrong. bundletool
// is the same tool Google Play itself uses to inspect bundles, and its
// `dump manifest` sub-command already prints the manifest back out as plain
// text XML — so we let it do the hard part and just parse simple, well-known
// attributes out of readable text.
//
// Setup: see docs/SETUP-BUNDLETOOL.md. In short: Java 11+ and a bundletool
// jar on PATH (as `bundletool`) or pointed to via CHECKAPP_BUNDLETOOL_JAR.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { inspectOptimizationSignals } from './android-optimization.js';

/**
 * @typedef {Object} AndroidManifestData
 * @property {string|null} packageName
 * @property {number|null} versionCode
 * @property {string|null} versionName
 * @property {number|null} targetSdkVersion
 * @property {number|null} minSdkVersion
 * @property {string[]} permissions
 * @property {string} rawManifestXml
 * @property {number|null} dexTotalBytes total uncompressed size of the base module's classes*.dex
 *   files, or null if it couldn't be determined (see inspectAndroidBundle's try/catch below)
 * @property {boolean|null} hasBaselineProfile
 * @property {number|null} ownPackageClassTotal type descriptors found under the app's own package
 * @property {number|null} ownPackageReadableNameCount ...of those, how many still look unobfuscated
 */

/** Returned in place of real OptimizationSignals when the direct zip/dex read fails or is skipped. */
const UNAVAILABLE_OPTIMIZATION_SIGNALS = {
  dexTotalBytes: null,
  hasBaselineProfile: null,
  ownPackageClassTotal: null,
  ownPackageReadableNameCount: null,
};

export class BundletoolNotFoundError extends Error {
  constructor(cmd) {
    super(
      `Could not run bundletool ("${cmd}"). Java + a bundletool jar are required to ` +
        `inspect a real .aab. See docs/SETUP-BUNDLETOOL.md for how to install it, or set ` +
        `CHECKAPP_BUNDLETOOL_JAR to an absolute path of the jar.`
    );
    this.name = 'BundletoolNotFoundError';
  }
}

function resolveBundletoolCommand() {
  const jarPath = process.env.CHECKAPP_BUNDLETOOL_JAR;
  if (jarPath) {
    if (!existsSync(jarPath)) {
      throw new BundletoolNotFoundError(`java -jar ${jarPath}`);
    }
    return { cmd: 'java', baseArgs: ['-jar', jarPath] };
  }
  // Fall back to a `bundletool` command on PATH (e.g. a shell wrapper script,
  // or a Homebrew/apt-installed build).
  return { cmd: 'bundletool', baseArgs: [] };
}

/**
 * Runs `bundletool dump manifest` against a real .aab and parses the
 * handful of attributes CheckApp's rules currently need out of the text
 * output. Intentionally dependency-free: these are simple, well-documented
 * attribute names, not a general XML parser.
 *
 * @param {string} aabPath absolute or relative path to a .aab file
 * @returns {AndroidManifestData}
 */
export function inspectAndroidBundle(aabPath) {
  if (!existsSync(aabPath)) {
    throw new Error(`AAB not found at ${aabPath}`);
  }

  const { cmd, baseArgs } = resolveBundletoolCommand();
  let rawManifestXml;
  try {
    rawManifestXml = execFileSync(
      cmd,
      [...baseArgs, 'dump', 'manifest', '--bundle', aabPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new BundletoolNotFoundError(cmd);
    }
    throw new Error(`bundletool failed on ${aabPath}: ${err.message}`);
  }

  const manifestData = parseManifestXml(rawManifestXml);

  // Best-effort by design: this reads the .aab directly as a zip (see
  // android-optimization.js) rather than going through bundletool, which is
  // newer and riskier code than the plain-text manifest parsing above. A bug
  // here, or a bundle shaped in some way this doesn't expect, must never take
  // down the rest of the scan — the app-optimization rule treats null
  // signals as "unavailable" and simply says nothing about them, rather than
  // guessing or crashing a scan that would otherwise succeed.
  let optimizationSignals;
  try {
    optimizationSignals = inspectOptimizationSignals(aabPath, manifestData.packageName);
  } catch {
    optimizationSignals = UNAVAILABLE_OPTIMIZATION_SIGNALS;
  }

  return { ...manifestData, ...optimizationSignals };
}

/**
 * Parses the subset of AndroidManifest.xml attributes CheckApp's rules need,
 * out of the plain-text XML that `bundletool dump manifest` prints. Exported
 * separately from inspectAndroidBundle so it can be unit-tested without a
 * real bundletool install or a real .aab file.
 *
 * @param {string} xml
 * @returns {AndroidManifestData}
 */
export function parseManifestXml(xml) {
  const packageName = firstMatch(xml, /<manifest[^>]*\bpackage="([^"]+)"/);
  const versionCodeRaw = firstMatch(xml, /\bandroid:versionCode="(\d+)"/);
  const versionName = firstMatch(xml, /\bandroid:versionName="([^"]+)"/);
  const targetSdkRaw = firstMatch(xml, /<uses-sdk\b[^>]*\bandroid:targetSdkVersion="(\d+)"/);
  const minSdkRaw = firstMatch(xml, /<uses-sdk\b[^>]*\bandroid:minSdkVersion="(\d+)"/);

  const permissions = [...xml.matchAll(/<uses-permission[^>]*\bandroid:name="([^"]+)"/g)].map(
    (m) => m[1]
  );

  return {
    packageName: packageName ?? null,
    versionCode: versionCodeRaw ? Number.parseInt(versionCodeRaw, 10) : null,
    versionName: versionName ?? null,
    targetSdkVersion: targetSdkRaw ? Number.parseInt(targetSdkRaw, 10) : null,
    minSdkVersion: minSdkRaw ? Number.parseInt(minSdkRaw, 10) : null,
    permissions,
    rawManifestXml: xml,
  };
}

function firstMatch(text, regex) {
  const m = text.match(regex);
  return m ? m[1] : null;
}

/**
 * Lightweight readiness check: confirms bundletool can actually be invoked
 * (Java present, jar/wrapper resolvable) without needing a real .aab to test
 * against. Used by the web portal's /healthz so a misconfigured deployment
 * fails loudly and immediately, instead of only failing on someone's first
 * real upload with a confusing 500.
 *
 * @returns {{ ok: true, version: string } | { ok: false, error: string }}
 */
export function checkBundletoolAvailable() {
  const { cmd, baseArgs } = resolveBundletoolCommand();
  try {
    const out = execFileSync(cmd, [...baseArgs, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, version: out.trim() };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { ok: false, error: new BundletoolNotFoundError(cmd).message };
    }
    return { ok: false, error: err.message };
  }
}
