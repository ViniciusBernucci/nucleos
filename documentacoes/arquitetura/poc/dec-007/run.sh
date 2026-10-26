#!/usr/bin/env bash
# Sobe PostgreSQL, Redis e Temporal (dev) descartaveis em 127.0.0.1, roda a PoC e destroi os containers.
# Uso: ./run.sh            (tudo, ~10-15 min)   |   ONLY=pg ./run.sh   |   SKIP_PERF=1 ./run.sh
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.local/opt/node-v24.22.1-linux-x64/bin:$HOME/.local/bin:$PATH"
PGPASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"; export PGPASSWORD  # descartavel, nunca impresso
trap 'for n in dec007-pg dec007-redis dec007-temporal; do docker rm -fv "$n" >/dev/null 2>&1 || true; done' EXIT
node --version
npm ci --silent
node poc.mjs
