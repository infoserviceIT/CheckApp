# Setting up bundletool

CheckApp's Android inspector shells out to Google's own [`bundletool`](https://github.com/google/bundletool)
to read a `.aab`'s manifest, rather than re-implementing an Android Binary XML /
protobuf parser. You need Java 11+ and the bundletool jar.

> Note for maintainers: this file was written without being able to download
> the jar in the sandbox the project was scaffolded in (outbound GitHub
> release downloads were blocked there). The steps below follow bundletool's
> documented usage; if you hit something that doesn't match once you actually
> run it, please open an issue or send a PR fixing this doc.

## 1. Check Java

```bash
java -version   # need 11+
```

## 2. Get bundletool

Download the latest `bundletool-all-*.jar` from the
[GitHub releases page](https://github.com/google/bundletool/releases/latest).

## 3. Make it runnable as `bundletool`

Either put a tiny wrapper script on your `PATH`:

```bash
#!/usr/bin/env bash
exec java -jar /path/to/bundletool-all-X.Y.Z.jar "$@"
```

save it as `bundletool`, `chmod +x` it, and make sure its directory is on `PATH` — or skip the
wrapper and just point CheckApp at the jar directly:

```bash
export CHECKAPP_BUNDLETOOL_JAR=/path/to/bundletool-all-X.Y.Z.jar
```

## 4. Verify

```bash
bundletool dump manifest --bundle=/path/to/some.aab
# or, with the env var instead:
java -jar $CHECKAPP_BUNDLETOOL_JAR dump manifest --bundle=/path/to/some.aab
```

You should see the app's `AndroidManifest.xml` printed as text. That's exactly what
`src/inspectors/android-bundletool.js` parses.

## In CI (GitHub Actions)

`ubuntu-latest` runners ship a JDK already. A minimal step — note this resolves
the actual release asset URL from the GitHub API instead of hardcoding a
filename: bundletool's asset name is versioned (`bundletool-all-X.Y.Z.jar`),
so a hardcoded `latest/download/bundletool-all.jar` URL 404s the moment the
version changes, and plain `curl -L` without `-f` won't even notice — it just
saves the 404 page as if it were the jar. (This is exactly what broke the
first real run of this project's own `.github/workflows/ci.yml`; see that
file for the full version of this step.)

```yaml
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: '17'
- env:
    GH_TOKEN: ${{ github.token }}
  run: |
    set -euo pipefail
    DOWNLOAD_URL=$(curl -sL -H "Authorization: Bearer $GH_TOKEN" \
        https://api.github.com/repos/google/bundletool/releases/latest \
      | grep -o '"browser_download_url": *"[^"]*bundletool-all[^"]*\.jar"' \
      | sed 's/.*"\(https[^"]*\)"/\1/')
    curl -fL -o bundletool.jar "$DOWNLOAD_URL"
    echo 'java -jar '"$PWD"'/bundletool.jar "$@"' > /usr/local/bin/bundletool
    chmod +x /usr/local/bin/bundletool
- run: node bin/checkapp.js scan path/to/app.aab
```
