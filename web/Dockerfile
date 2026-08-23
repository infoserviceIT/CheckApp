# CheckApp web portal — Node (Express server) + a JRE, because bundletool
# (Java 11+) is the one real external dependency the whole project has.
#
# Build from the REPO ROOT, not from inside web/ — this Dockerfile copies
# both src/ (the checkapp library) and web/ (this portal), so the build
# context has to be the parent directory:
#   docker build -f web/Dockerfile -t checkapp-web .
#
# Note on the bundletool version: unlike .github/workflows/ci.yml, which
# deliberately always grabs bundletool's LATEST release (so CI notices a
# future incompatibility as soon as it exists), this image PINS an exact,
# already-verified version. A production image shouldn't silently change
# behavior on a rebuild just because Google shipped a new bundletool release
# — bump BUNDLETOOL_VERSION on purpose, rebuild, redeploy, don't let it drift.
FROM node:20-bookworm-slim

ARG BUNDLETOOL_VERSION=1.18.3

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      openjdk-17-jre-headless \
      curl \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fL -o /opt/bundletool.jar \
      "https://github.com/google/bundletool/releases/download/${BUNDLETOOL_VERSION}/bundletool-all-${BUNDLETOOL_VERSION}.jar" && \
    printf '#!/usr/bin/env bash\nexec java -jar /opt/bundletool.jar "$@"\n' > /usr/local/bin/bundletool && \
    chmod +x /usr/local/bin/bundletool && \
    bundletool version

WORKDIR /app

# Only what the web server actually imports from the parent library — not
# the whole repo (tests, docs, .git, CI config, ...).
COPY src/ /app/src/

COPY web/package.json web/package-lock.json* /app/web/
RUN cd /app/web && npm install --omit=dev

COPY web/server.js /app/web/server.js
COPY web/public/ /app/web/public/

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# The official Node image already has a non-root 'node' user — use it
# instead of running an internet-facing process as root.
RUN chown -R node:node /app
USER node

CMD ["node", "web/server.js"]
