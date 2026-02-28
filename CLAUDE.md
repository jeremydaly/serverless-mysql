# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

serverless-mysql is a Node.js wrapper around `mysql2` that adds connection management optimized for serverless environments (AWS Lambda, GCP Cloud Functions, Azure Functions). It handles connection pooling/reuse, zombie cleanup, exponential backoff with jitter, and connection utilization monitoring.

## Commands

```bash
# Lint
npm run lint

# Unit tests (no external dependencies)
npm run test:unit

# Integration tests (requires running MySQL)
npm run test:integration

# All tests with Docker-managed MySQL (recommended)
npm run test:docker

# Start MySQL for local integration testing
docker compose up -d
# Then run integration tests
npm run test:integration
# Stop when done
docker compose down

# Run a single test file
TZ=UTC mocha --check-leaks test/unit/connection-config.spec.js
TZ=UTC mocha --check-leaks test/integration/features.spec.js

# Coverage report (outputs to coverage/)
npm run test-cov
```

Integration test MySQL connection defaults: `root:password@127.0.0.1:3306/serverless_mysql_test`. Override with env vars: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`.

## Architecture

**Single-file library:** All library code is in `index.js` (~545 lines). Types are in `index.d.ts`. There is no build step.

`index.js` exports a factory function that returns an object with public methods. Each invocation creates a closure with mutable state (`client`, `counter`, `errors`, `retries`, `_cfg`, `_maxConns`, `_usedConns`).

Key internal flows:
- **`connect(wait)`** — establishes connection with exponential backoff retry. Checks connection utilization (`manageConns`) and kills zombie connections when thresholds are exceeded.
- **`query(...args)`** — runs queries with automatic retry on transient errors (`retryableQueryErrors`). Separate retry logic from connection retries.
- **`end()`** — connection management call meant to be invoked at the end of each serverless invocation. Increments reuse counter or destroys connection based on utilization.
- **`commit(queries, rollback)`** — executes transaction queries sequentially, rolling back on failure.

Two error code lists drive retry behavior:
- `tooManyConnsErrors` — triggers connection-level retries with backoff
- `retryableQueryErrors` — triggers query-level retries

Backoff supports "full" jitter, "decorrelated" jitter, or a custom function.

## Code Style

- 2-space indentation, single quotes, no semicolons, unix line endings
- ES8 / Node.js CommonJS modules (`require`/`module.exports`)
- All async operations return Promises (async/await pattern)
- Test framework: Mocha + Chai (assertions) + Sinon (mocks/stubs) + Rewire (module injection)
- Tests use `--check-leaks` flag; all tests run with `TZ=UTC`

## Test Structure

- `test/unit/` — tests that mock mysql2 (no DB needed). Uses `rewire` to inject mock dependencies.
- `test/integration/` — tests against a real MySQL instance. Uses helpers in `test/integration/helpers/setup.js` for connection factory, table setup/teardown.
- `test/unit/helpers/mocks.js` — Sinon-based mock connection and mysql2 module factories.

## CI

GitHub Actions runs unit tests + lint on Node 18/20/22. Integration tests run on Node 18/20/22 × MySQL 5 & LTS (matrix). PRs target `master`.
