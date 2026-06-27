#!/usr/bin/env bash
# Boot the benchmark stack, build the Lambda package, run the benchmark, tear down.
# Any extra args are forwarded to bench.js (e.g. CONCURRENCY/DURATION_MS via env).
set -euo pipefail

cd "$(dirname "$0")"

cleanup() { docker compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Starting benchmark stack (LocalStack + MySQL)..."
# --wait blocks until both services report healthy (see healthchecks in compose).
docker compose up -d --wait

echo "Building Lambda package..."
./build.sh

echo "Running benchmark..."
node bench.js "$@"
