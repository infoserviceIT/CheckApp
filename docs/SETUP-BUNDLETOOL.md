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

`ubuntu-latest` runners ship a JDK already. A minimal step:

```yaml
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: '17'
- run: |
    curl -L -o bundletool.jar \
      https://github.com/google/bundletool/releases/latest/download/bundletool-all.jar
    echo 'java -jar '"$PWD"'/bundletool.jar "$@"' > /usr/local/bin/bundletool
    chmod +x /usr/local/bin/bundletool
- run: node bin/checkapp.js scan path/to/app.aab
```

(Double-check the exact release asset filename on the releases page — Google
occasionally changes the naming convention between versions.)
