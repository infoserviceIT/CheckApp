# CheckApp

[![CI](https://github.com/infoserviceIT/CheckApp/actions/workflows/ci.yml/badge.svg)](https://github.com/infoserviceIT/CheckApp/actions/workflows/ci.yml)

Checks a real Android/iOS build against Apple App Store and Google Play
guidelines — compliance *and* usability — before it reaches a human
reviewer, instead of finding out after a rejection.

No single existing tool does this end to end: [PWABuilder's Report
Card](https://www.pwabuilder.com/reportcard) only looks at the PWA manifest,
[Base44's App Scan](https://docs.base44.com/documentation/building-your-app/uploading-to-app-stores)
is UI-native-feel checks locked inside a closed web tool with no API,
[AcceptMyApp](https://acceptmy.app/) only reads iOS store-listing metadata,
and Google Play's own pre-launch report only runs *after* you've already
uploaded to Play Console. CheckApp's job is to be the one thing that reads
the actual binary, runs against both stores' real guidelines, and gives a
single report — before any of that.

Full architecture, research, and roadmap: see the project's design document
(ask in the repo/organization this was scaffolded for if you don't have the
link — it's not duplicated here so this README doesn't go stale next to it).

## Status: early, Android-only, Phase 1

This is a fresh scaffold, not a finished tool. What's real today:

- A CLI (`checkapp scan app.aab`) that reads a real Android App Bundle via
  Google's own `bundletool` (see `docs/SETUP-BUNDLETOOL.md`) and runs 5
  rules against it: target SDK floor, package name, versionCode,
  versionName, and a permissions inventory.
- One of those rules is not academic: Google Play requires
  `targetSdkVersion 36` for every new submission/update from **2026-08-31**
  (technical extension to 2026-11-01 available in Play Console), and at
  least one popular AAB-packaging path (PWABuilder/Bubblewrap) was still
  generating `targetSdkVersion 35` as of this writing. `checkapp scan` catches
  that before you find out from a Play Console rejection.
- Actionable findings carry a concrete `remediation` field — not just
  "what's wrong" but "what to change and where" (Gradle vs. Expo/EAS vs.
  Bubblewrap config, specifically) — surfaced as a `Fix: ...` line in the
  CLI, in `--json` output, and in the web portal. The permissions inventory
  expands this further: one finding per Play-Console-restricted permission
  (`SYSTEM_ALERT_WINDOW`, `ACCESS_BACKGROUND_LOCATION`,
  `MANAGE_EXTERNAL_STORAGE`, SMS/Call Log, `QUERY_ALL_PACKAGES`,
  `BIND_ACCESSIBILITY_SERVICE`) plus a consolidated Data Safety reminder —
  all advisory (`warn`), never blocking, since whether they're actually a
  problem depends on a Play Console declaration this tool can't see.
- iOS support, an AI-assisted remediation layer (natural-language,
  code-aware suggestions — a step beyond the static guidance above), and
  the rest of the ~30-rule catalog (privacy, health-app disclaimers,
  in-app-purchase routing, accessibility, native-feel UX) are Phase 2+ —
  see `CONTRIBUTING.md`.

## Quickstart

```bash
npm install
node bin/checkapp.js scan path/to/app.aab
# or, for machine-readable output:
node bin/checkapp.js scan path/to/app.aab --json
```

Needs Java + `bundletool` available — see `docs/SETUP-BUNDLETOOL.md` if you
don't have it set up yet. Without it, `checkapp` fails with a clear message
telling you what's missing rather than a stack trace.

## Project layout

```
bin/checkapp.js              CLI entry point
src/cli.js                   argument parsing + orchestration
src/inspectors/               reads a build into structured data (currently: android via bundletool)
src/rules/                    one module per rule; index.js per platform registers them
src/report/format.js          turns findings into a console table or JSON
test/                         node:test — no external test framework dependency
docs/SETUP-BUNDLETOOL.md      how to install the one external dependency this has
web/                          optional web portal (anonymous upload-and-scan) — see web/README.md
```

## Web portal

For people who don't want to install Java/bundletool locally (or just want
a link to share), `web/` is a small Express server that wraps this same
library behind an upload-a-`.aab`-get-a-report page — no accounts, nothing
stored. It's a separate, optional layer: the CLI/library above works
completely on its own without it. See `web/README.md` for running it
locally, the Dockerfile, and deploy notes (Fly.io/Render).

## Why a CLI/library first, not a hosted portal

This is meant to be open source from day one. A CLI you can `npx` locally or
drop into a GitHub Actions step is the shape people actually adopt and
contribute to; a hosted multi-tenant portal is something to consider
*wrapping around this* later, if/when it makes sense to extend or productize
it — not the starting point.

## License

MIT — see `LICENSE`.
