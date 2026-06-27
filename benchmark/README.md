# serverless-mysql Benchmarks

A reproducible benchmark that compares **serverless-mysql** against the naive
**connection-per-call** approach it replaces, using a *real Lambda fleet* (via
[LocalStack](https://localstack.cloud/)) against a connection-constrained MySQL.
It provides a before/after that anyone can run.

## What it measures

For each concurrency level, a fixed-duration concurrent workload is fired at each
driver while the database's open-connection count is sampled. We report:

- **Success rate** — including the breakdown of failures by error code
  (`ER_CON_COUNT_ERROR` when the connection cap is exceeded).
- **Peak open connections** — sampled from `SHOW STATUS LIKE 'Threads_connected'`.
- **Throughput & latency** — invocations/sec and p50 / p95 / p99.

### The two drivers

| Driver | Behavior |
| --- | --- |
| `serverless-mysql (managed)` | A module-scoped instance persisting across warm invocations. Reuses a warm connection and, under high `max_connections` utilization, releases it and retries with backoff instead of piling up connections. |
| `raw mysql2 (per-call)` | Opens a fresh `mysql2` connection per invocation. At concurrency above `max_connections` it fails with `ER_CON_COUNT_ERROR`. |

Both run the identical query (`SELECT SLEEP(...)`) so the comparison is fair —
the managed driver's latency *includes* the library's management overhead.

## Running it

Requires **Docker** (with the Docker socket available to LocalStack) and **Node 18+**.

```bash
npm ci                 # installs @aws-sdk/client-lambda + mysql2 (from repo root)
npm run benchmark      # boot stack -> build -> run -> write results.json / results.md
```

To also inject the results into the top-level README:

```bash
npm run benchmark:readme
```

### Knobs (environment variables)

| Var | Default | Meaning |
| --- | --- | --- |
| `CONCURRENCY` | `5,10,20,30` | Comma-separated concurrency levels (kept ≤ LocalStack's reliable ceiling) |
| `DURATION_MS` | `8000` | Duration per driver/level |
| `QUERY_SLEEP` | `0.02` | Seconds the query holds the connection |
| `MAX_CONNECTIONS` | `30` | Recorded in metadata; set to match docker-compose |

`max_connections` itself is set in [`docker-compose.yml`](docker-compose.yml); keep
the `MAX_CONNECTIONS` env in sync if you change it.

## How it fits together

- [`docker-compose.yml`](docker-compose.yml) — LocalStack + MySQL on a shared network.
- [`lambda/handler.js`](lambda/handler.js) — the two drivers (`MODE=managed|raw`).
- [`build.sh`](build.sh) — packages the handler with `mysql2` and the working-tree
  `serverless-mysql` into `function.zip`.
- [`bench.js`](bench.js) — deploys both functions to LocalStack, runs the workload,
  polls connections, writes `results.json` / `results.md`.
- [`update-readme.js`](update-readme.js) — injects the table into the top-level README.
- [`run.sh`](run.sh) — orchestrates the whole thing.

## Caveats

LocalStack *emulates* Lambda; container reuse, concurrency limits, and cold-start
timing differ from real AWS, and Community-edition concurrency is throttled (hence
the modest default levels). Absolute numbers vary by hardware — treat them as a
demonstration of the **mechanism and relative behavior**, not production SLAs. The
only strictly more faithful setup is real AWS Lambda + Aurora.
