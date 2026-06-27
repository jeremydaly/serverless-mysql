# Benchmark Results

Generated: 2026-06-27T16:37:55.159Z · MySQL `max_connections=30` · query `SELECT SLEEP(0.02)` · 8s per level · Node v20.19.5

| Driver | Concurrency | Success rate | Throughput (inv/s) | p50 (ms) | p95 (ms) | p99 (ms) | Peak conns | Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| serverless-mysql (managed) | 5 | 100% | 126.6 | 22 | 23 | 24 | 6 | — |
| raw mysql2 (per-call) | 5 | 100% | 125.9 | 23 | 25 | 30 | 11 | — |
| serverless-mysql (managed) | 10 | 100% | 238.2 | 22 | 22 | 24 | 11 | — |
| raw mysql2 (per-call) | 10 | 100% | 233.9 | 22 | 25 | 30 | 21 | — |
| serverless-mysql (managed) | 20 | 100% | 170.5 | 22 | 24 | 35 | 21 | — |
| raw mysql2 (per-call) | 20 | 98.7% | 155.8 | 23 | 28 | 73 | 31 | ER_CON_COUNT_ERROR×17 |
| serverless-mysql (managed) | 30 | 100% | 157.3 | 22 | 26 | 40 | 27 | — |
| raw mysql2 (per-call) | 30 | 97.4% | 129.2 | 23 | 29 | 54 | 31 | ER_CON_COUNT_ERROR×29 |

> Run on a single host via LocalStack Lambda + MySQL in Docker. Numbers illustrate the
> connection-management mechanism and relative behavior, not absolute production SLAs.
