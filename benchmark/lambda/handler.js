'use strict';

// One handler, two drivers selected by the MODE env var:
//
//   managed -> a module-scoped serverless-mysql instance that PERSISTS across warm
//              invocations (the real Lambda+RDS pattern). Per call it runs a query and
//              then calls .end(), which triggers serverless-mysql's connection
//              management: under high `max_connections` utilization it releases the
//              connection and retries with backoff instead of piling up connections.
//
//   raw     -> a fresh mysql2 connection opened per invocation, queried, and closed.
//              This is the naive "connection-per-call" model serverless-mysql replaces;
//              at concurrency above `max_connections` it fails with ER_CON_COUNT_ERROR.
//
// Both run the identical query so the comparison is apples-to-apples.

const MODE = process.env.MODE || 'managed';
const QUERY_SLEEP = Number(process.env.QUERY_SLEEP || 0.02); // seconds of held connection time

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'benchmark',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  // Keep the failure fast and explicit so the metrics show connection pressure
  // rather than the harness hanging on a saturated server.
  connectTimeout: 5000
};

const mysql2 = require('mysql2/promise');

// Module scope: survives across warm invocations of the same container, which is the
// whole point of the managed driver. Created lazily on first invocation.
let managedDb = null;
function getManagedDb() {
  if (!managedDb) {
    managedDb = require('serverless-mysql')({ config: dbConfig });
  }
  return managedDb;
}

exports.handler = async function () {
  const start = Date.now();
  try {
    if (MODE === 'managed') {
      const db = getManagedDb();
      await db.query('SELECT SLEEP(?) AS slept', [QUERY_SLEEP]);
      await db.end(); // runs connection-management logic; does not hard-close warm conns
    } else {
      const conn = await mysql2.createConnection(dbConfig);
      try {
        await conn.query('SELECT SLEEP(?) AS slept', [QUERY_SLEEP]);
      } finally {
        await conn.end();
      }
    }
    return { ok: true, ms: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - start,
      code: err && (err.code || err.name) || 'UNKNOWN',
      message: err && err.message
    };
  }
};
