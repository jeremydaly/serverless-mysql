# AGENTS.md

Node.js wrapper around `mysql2` for serverless environments (AWS Lambda, GCP Cloud Functions, Azure Functions). Single-file library — no build step. Manages connection pooling/reuse, zombie cleanup, exponential backoff, and utilization monitoring.

**Stack:** Node.js (>=8.10), CommonJS, mysql2 ^3.12.0, Mocha for testing (Chai for integration assertions, Node `assert` for unit tests, Sinon for mocks).

## Commands

```bash
npm run lint                        # ESLint
npm run test:unit                   # Unit tests (no DB needed)
npm run test:integration            # Integration tests (requires MySQL)
npm run test:docker                 # All tests with Docker-managed MySQL
npm run test-cov                    # Coverage report → coverage/

# Single test file
TZ=UTC npx mocha --check-leaks test/unit/connection-config.spec.js
TZ=UTC npx mocha --check-leaks test/integration/features.spec.js

# Local MySQL for integration tests
docker compose up -d
npm run test:integration
docker compose down
```

MySQL defaults: `root:password@127.0.0.1:3306/serverless_mysql_test`
Override via: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`

## Code Style

2-space indent, single quotes, no semicolons, unix line endings. Enforced by ESLint.

```js
// Yes
const result = await mysql.query('SELECT * FROM users')

// No
const result = await mysql.query("SELECT * FROM users");
```

## Architecture

All library code lives in `index.js` (~545 lines). Types in `index.d.ts`.

`index.js` exports a factory function returning a public API object. Each call creates a closure with mutable state (`client`, `counter`, `errors`, `retries`, `_cfg`, `_maxConns`, `_usedConns`).

Key flows:

- **`connect(wait)`** — connection with exponential backoff retry; checks utilization and kills zombies when thresholds exceeded
- **`query(...args)`** — query execution with automatic retry on transient errors (`retryableQueryErrors`)
- **`end()`** — end-of-invocation cleanup; increments reuse counter or destroys connection based on utilization
- **`commit(queries, rollback)`** — sequential transaction execution with rollback on failure

Two error code lists drive retries:

- `tooManyConnsErrors` — connection-level retries with backoff
- `retryableQueryErrors` — query-level retries

## Testing

- `test/unit/` — configuration-focused tests using Node's built-in `assert`; no DB required
- `test/integration/` — real MySQL; uses `test/integration/helpers/setup.js` for connection factory, table setup/teardown
- All tests run with `TZ=UTC` and `--check-leaks`

## Git Workflow

- PRs target `master`
- CI: GitHub Actions — unit tests on Node 18/20/22, lint on Node 22, integration tests on Node 18/20/22 × MySQL 5 & LTS

## Boundaries

**Never:**

- Add a build/transpilation step — this is a single-file CommonJS library
- Introduce callback-style APIs — all async operations return Promises
- Modify `index.d.ts` types without matching changes in `index.js`
