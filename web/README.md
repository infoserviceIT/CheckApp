# CheckApp — web portal

An anonymous upload-and-scan web front end for CheckApp: drag in a `.aab`,
get a report on the page. No accounts, no stored data — the uploaded file
exists only for the duration of one scan, then it's deleted (see the
cleanup logic in `server.js` if you want to verify that claim yourself).

This is a thin HTTP wrapper. All the actual rule logic is the same
`../src` the CLI uses — nothing about *what* gets checked changes here,
only *how you reach it*.

## Running locally

You need the same two things the CLI needs (see `../docs/SETUP-BUNDLETOOL.md`):
Java 11+, and bundletool on `PATH` (or `CHECKAPP_BUNDLETOOL_JAR` set).

```bash
cd web
npm install
npm start
# → http://localhost:8080
```

## Deploying

The whole thing is one `Dockerfile` (Node + a JRE + bundletool baked in at
build time) — it'll run anywhere that runs a container. **Build from the
repo root**, not from inside `web/`, since the image needs both `src/` and
`web/`:

```bash
docker build -f web/Dockerfile -t checkapp-web .
docker run -p 8080:8080 checkapp-web
```

### Where to host it — keep it off the Axis Core VPS

If you already run other things (n8n, Ghost, ...) in Docker on a VPS for
Axis Core, this deliberately does **not** go there, for one concrete reason:
this service accepts **anonymous public file uploads** and runs them through
a JVM parser — a meaningfully different risk/blast-radius profile than n8n
(which holds real credentials/webhooks) or Ghost (a public site with its own
uptime expectations) sitting on the same host. A resource spike, a
malformed-upload edge case, or a future container-escape bug here shouldn't
be able to touch either of those.

Recommendation: **a separate, small managed container host** — Fly.io or
Render — rather than either squeezing this onto the existing VPS, or buying
and self-managing a second one. Concretely, as of August 2026:

- **Render**: has an actual free tier (512MB RAM / 0.1 CPU) for a Docker web
  service — good enough to validate this with real traffic at $0/month
  before committing to anything. The free tier is known to spin down after
  a period of inactivity and take a bit to wake back up on the next
  request — acceptable for an MVP (the page already sets that expectation:
  "può richiedere qualche secondo"), less so once this gets real regular
  traffic. The cheapest always-on tier (Starter) is $7/month for 512MB/0.5
  CPU. [Render pricing](https://render.com/pricing).
- **Fly.io**: no free allowance for new accounts anymore (that changed at
  some point before 2026) — it's pay-as-you-go from the first machine.
  A `shared-cpu-1x`/512MB machine is about $3.32/month running continuously,
  1GB is about $6.39/month; `fly.toml` here is set to scale to zero machines
  when idle (`auto_stop_machines`/`min_machines_running = 0`), which still
  leaves a small per-GB storage charge for the stopped machine's image, but
  is close to free for low/bursty traffic. [Fly.io pricing](https://fly.io/docs/about/pricing/).

Either is a low-cost, fully isolated (different provider, different
infrastructure entirely) way to get this live without taking on VPS
ops work (TLS, firewall, OS patching, restart-on-crash) yourself. Start on
Render's free tier since it matches "let's see if this is useful" with zero
commitment; move to a paid tier (either platform) once it's something people
actually rely on. If you'd rather have full control and are comfortable with
the ops overhead, a second small VPS works too — just keep it a *second*
one, not a container next to n8n/Ghost on the first.

### Deploying to Fly.io

`fly.toml` is at the repo root already (it needs the same build context as
the Dockerfile). From the repo root:

```bash
fly launch --copy-config --no-deploy   # first time only — review app name/region it picks
fly deploy                              # this and every update after
```

### Deploying to Render

Render builds straight from a Dockerfile via its dashboard — no extra config
file needed: New → Web Service → connect this repo → set **Dockerfile
path** to `web/Dockerfile` and **Docker build context** to the repo root
(`.`) → set the health check path to `/healthz` → deploy.

## What's actually been verified vs. not

Being upfront about this, same as everywhere else in this project:

- **Verified locally**: the full HTTP flow (upload → inspect → rules →
  JSON report), file-size limits, rejecting non-`.aab` uploads, the
  `/healthz` check, and — importantly — that the cleanup logic actually
  deletes every uploaded file, success or failure. This was tested against
  a stand-in "fake bundletool" script (since this development environment
  couldn't reach a real bundletool jar), so the HTTP/Express layer itself is
  solid, but not with real Java/bundletool.
- **Verified locally, separately**: the exact directory layout the
  `Dockerfile` produces (`/app/src` + `/app/web`, and the `../src` import
  from `web/server.js` resolving correctly across that boundary) — done by
  reproducing that layout by hand and running the server from it.
- **Not yet verified**: an actual `docker build` of this Dockerfile
  end-to-end. This development sandbox hit a Docker Hub rate limit
  (`429 Too Many Requests` pulling `node:20-bookworm-slim`) and — same as
  the CLI's own CI history — can't reach `github.com` to download the real
  bundletool jar either. Neither restriction is specific to this Dockerfile;
  they're sandbox-only. The reliable way to get a real end-to-end check is
  the same one that worked for the CLI: a GitHub Actions job that builds
  this image and smoke-tests it against a real `.aab` (see
  `.github/workflows/ci.yml` — this is exactly what task is next). Until
  that's added (or you build it once yourself locally), treat the image as
  reasoned-through-carefully rather than proven.
