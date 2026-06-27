'use strict';

// Benchmark driver. Deploys two Lambda functions (managed = serverless-mysql,
// raw = mysql2 connection-per-call) to LocalStack, then for each concurrency level
// fires a fixed-duration concurrent workload at each while sampling the database's
// open-connection count. Emits results.json and results.md.
//
// Everything talks to LocalStack over the AWS SDK, so no aws-cli / awslocal needed.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const {
  LambdaClient,
  CreateFunctionCommand,
  DeleteFunctionCommand,
  GetFunctionConfigurationCommand,
  InvokeCommand
} = require('@aws-sdk/client-lambda');
const { toMarkdownTable, metaLine } = require('./report');

// ---- Configuration (overridable via env) ----------------------------------
const ENDPOINT = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const REGION = 'us-east-1';
// Capped at 30 by default: LocalStack Community throttles concurrent Lambda
// containers, and levels at/above ~50 trigger a container-spawn storm that can
// hang the run. 30 matches the DB's max_connections so the crossover (raw failing
// once concurrency reaches the cap) is still clearly visible. Override via env.
const CONCURRENCY_LEVELS = (process.env.CONCURRENCY || '5,10,20,30')
  .split(',').map((n) => parseInt(n, 10));
const DURATION_MS = Number(process.env.DURATION_MS || 8000);
const QUERY_SLEEP = process.env.QUERY_SLEEP || '0.02';
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS || 30);

// Hostname the Lambda containers use to reach MySQL on the shared Docker network.
const DB_HOST_LAMBDA = process.env.DB_HOST_LAMBDA || 'benchmark-mysql';
// Host-side poller connection (mapped port from docker-compose).
const POLLER = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: 'root',
  password: 'password',
  database: 'benchmark'
};

const ZIP_PATH = path.join(__dirname, 'lambda', 'function.zip');
const FUNCTIONS = [
  { name: 'bench-managed', mode: 'managed', label: 'serverless-mysql (managed)' },
  { name: 'bench-raw', mode: 'raw', label: 'raw mysql2 (per-call)' }
];

const lambda = new LambdaClient({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Lambda lifecycle ------------------------------------------------------
async function deployFunctions(zip) {
  for (const fn of FUNCTIONS) {
    await lambda.send(new DeleteFunctionCommand({ FunctionName: fn.name })).catch(() => {});
    await lambda.send(new CreateFunctionCommand({
      FunctionName: fn.name,
      Runtime: 'nodejs20.x',
      Handler: 'handler.handler',
      Role: 'arn:aws:iam::000000000000:role/lambda-role', // LocalStack ignores validity
      Code: { ZipFile: zip },
      Timeout: 30,
      MemorySize: 256,
      Environment: {
        Variables: {
          MODE: fn.mode,
          DB_HOST: DB_HOST_LAMBDA,
          DB_PORT: '3306',
          DB_NAME: 'benchmark',
          DB_USER: 'root',
          DB_PASSWORD: 'password',
          QUERY_SLEEP: String(QUERY_SLEEP)
        }
      }
    }));
    await waitActive(fn.name);
    console.log(`deployed ${fn.name}`);
  }
}

async function waitActive(name) {
  for (let i = 0; i < 60; i++) {
    const cfg = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: name }));
    if (cfg.State === 'Active') return;
    if (cfg.State === 'Failed') throw new Error(`Lambda ${name} failed: ${cfg.StateReason}`);
    await sleep(1000);
  }
  throw new Error(`Lambda ${name} did not become Active in time`);
}

async function teardownFunctions() {
  for (const fn of FUNCTIONS) {
    await lambda.send(new DeleteFunctionCommand({ FunctionName: fn.name })).catch(() => {});
  }
}

async function invokeOnce(name) {
  try {
    const res = await lambda.send(new InvokeCommand({
      FunctionName: name,
      Payload: Buffer.from('{}')
    }));
    const payload = res.Payload ? JSON.parse(Buffer.from(res.Payload).toString('utf8')) : {};
    if (res.FunctionError || payload.ok === false) {
      return { ok: false, code: payload.code || res.FunctionError || 'INVOKE_ERROR', ms: payload.ms };
    }
    return { ok: true, ms: payload.ms };
  } catch (err) {
    return { ok: false, code: err.name || 'SDK_ERROR' };
  }
}

// ---- Connection-count poller ----------------------------------------------
async function startPoller(state) {
  const conn = await mysql.createConnection(POLLER);
  let stopped = false;
  const loop = (async () => {
    while (!stopped) {
      try {
        const [rows] = await conn.query("SHOW STATUS LIKE 'Threads_connected'");
        const n = Number(rows[0] && rows[0].Value);
        if (n > state.peak) state.peak = n;
      } catch (_) { /* transient under load; ignore */ }
      await sleep(50);
    }
  })();
  return async () => { stopped = true; await loop; await conn.end().catch(() => {}); };
}

// ---- Stats -----------------------------------------------------------------
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function runLevel(fn, concurrency) {
  const state = { peak: 0 };
  const stopPoller = await startPoller(state);

  const latencies = [];
  const failures = {};
  let success = 0;
  const deadline = Date.now() + DURATION_MS;

  async function worker() {
    while (Date.now() < deadline) {
      const r = await invokeOnce(fn.name);
      if (r.ok) { success++; if (typeof r.ms === 'number') latencies.push(r.ms); }
      else { failures[r.code] = (failures[r.code] || 0) + 1; }
    }
  }

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const elapsedSec = (Date.now() - startedAt) / 1000;
  await stopPoller();

  latencies.sort((a, b) => a - b);
  const failed = Object.values(failures).reduce((a, b) => a + b, 0);
  const total = success + failed;

  return {
    driver: fn.label,
    mode: fn.mode,
    concurrency,
    total,
    success,
    failed,
    successRate: total ? +(100 * success / total).toFixed(1) : 0,
    failuresByCode: failures,
    throughput: +(success / elapsedSec).toFixed(1),
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    peakConnections: state.peak
  };
}

// ---- Reporting -------------------------------------------------------------
async function main() {
  if (!fs.existsSync(ZIP_PATH)) {
    throw new Error(`Missing ${ZIP_PATH}. Run benchmark/build.sh first.`);
  }
  const zip = fs.readFileSync(ZIP_PATH);

  console.log('deploying functions to', ENDPOINT);
  await deployFunctions(zip);

  const rows = [];
  try {
    for (const concurrency of CONCURRENCY_LEVELS) {
      for (const fn of FUNCTIONS) {
        process.stdout.write(`running ${fn.mode} @ concurrency ${concurrency} ... `);
        const result = await runLevel(fn, concurrency);
        rows.push(result);
        console.log(`${result.successRate}% ok, ${result.throughput} inv/s, peak ${result.peakConnections} conns`);
        await sleep(1000); // let warm containers/connections settle between runs
      }
    }
  } finally {
    await teardownFunctions().catch(() => {});
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    durationMsPerLevel: DURATION_MS,
    querySleepSeconds: Number(QUERY_SLEEP),
    maxConnections: MAX_CONNECTIONS,
    concurrencyLevels: CONCURRENCY_LEVELS,
    node: process.version
  };

  const table = toMarkdownTable(rows);
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ meta, rows }, null, 2));

  const md = [
    '# Benchmark Results',
    '',
    metaLine(meta),
    '',
    table,
    '',
    '> Run on a single host via LocalStack Lambda + MySQL in Docker. Numbers illustrate the',
    '> connection-management mechanism and relative behavior, not absolute production SLAs.',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(__dirname, 'results.md'), md);

  console.log('\n' + table);
  console.log('\nwrote benchmark/results.json and benchmark/results.md');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
