'use strict'

const { expect } = require('chai')
const mysql = require('../../index')
const {
  createTestConnection,
  setupTestTable,
  cleanupTestTable,
  closeConnection,
} = require('./helpers/setup')

describe('Streaming Integration Tests', function () {
  this.timeout(15000)

  let db
  const TEST_TABLE = 'streaming_test_table'
  const TABLE_SCHEMA = `
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `

  before(async function () {
    db = createTestConnection({ returnFinalSqlQuery: true })
    await setupTestTable(db, TEST_TABLE, TABLE_SCHEMA)
  })

  beforeEach(async function () {
    await db.query(`TRUNCATE TABLE ${TEST_TABLE}`)
  })

  after(async function () {
    try {
      await cleanupTestTable(db, TEST_TABLE)

      if (db) {
        await db.end()
        await closeConnection(db)
      }
    } catch (err) {
      console.error('Error during cleanup:', err)
    }
  })

  it('should stream rows in order', async function () {
    await db.query(`INSERT INTO ${TEST_TABLE} (name) VALUES (?), (?), (?)`, [
      'Stream 1',
      'Stream 2',
      'Stream 3',
    ])

    const stream = db.query(`SELECT * FROM ${TEST_TABLE} ORDER BY id`).stream()
    const rows = []

    for await (const row of stream) {
      rows.push(row)
    }

    expect(rows).to.have.lengthOf(3)
    expect(rows[0].name).to.equal('Stream 1')
    expect(rows[1].name).to.equal('Stream 2')
    expect(rows[2].name).to.equal('Stream 3')
  })

  it('should expose final SQL on the stream when enabled', async function () {
    await db.query(`INSERT INTO ${TEST_TABLE} (name) VALUES (?)`, [
      'Stream SQL',
    ])

    const stream = db.query(`SELECT * FROM ${TEST_TABLE} ORDER BY id`).stream()

    for await (const row of stream) {
      expect(row).to.have.property('id')
    }

    expect(stream).to.have.property('sql')
    expect(stream.sql).to.include(`SELECT * FROM ${TEST_TABLE} ORDER BY id`)
  })

  it('should release the connection to end() after the stream is consumed', async function () {
    await db.query(`INSERT INTO ${TEST_TABLE} (name) VALUES (?)`, ['End Test'])

    const counterBefore = db.getCounter()

    const stream = db.query(`SELECT * FROM ${TEST_TABLE} ORDER BY id`).stream()
    for await (const row of stream) {
      void row
    }

    // end() must be callable and must increment the reuse counter,
    // confirming the connection is properly managed after streaming
    await db.end()

    expect(db.getCounter()).to.be.greaterThan(counterBefore)
  })

  it('should emit an error on the stream for a failed query', async function () {
    const stream = db
      .query('SELECT * FROM non_existent_table_xyz_streaming')
      .stream()

    let caughtErr = null
    try {
      for await (const row of stream) {
        void row
      }
    } catch (err) {
      caughtErr = err
    }

    expect(caughtErr).to.be.an('error')
    expect(caughtErr.code).to.equal('ER_NO_SUCH_TABLE')
    expect(stream.destroyed).to.equal(true)
  })

  it('should emit an error when .stream() is called after the query has already executed', async function () {
    // Awaiting the promise first forces the non-streaming (callback) path.
    // Calling .stream() afterwards should return an error stream that emits
    // "Stream is not available for this query".
    const promise = db.query(`SELECT 1`)
    await promise

    const stream = promise.stream()
    let caughtErr = null
    try {
      for await (const row of stream) {
        void row
      }
    } catch (err) {
      caughtErr = err
    }

    expect(caughtErr).to.be.an('error')
    expect(caughtErr.message).to.equal('Stream is not available for this query')
  })

  it('should forward the fields event to the stream proxy', async function () {
    await db.query(`INSERT INTO ${TEST_TABLE} (name) VALUES (?)`, ['Fields Test'])

    const stream = db.query(`SELECT * FROM ${TEST_TABLE} ORDER BY id`).stream()

    let receivedFields = null
    stream.on('fields', (fields) => { receivedFields = fields })

    for await (const row of stream) {
      void row
    }

    expect(receivedFields).to.be.an('array')
    expect(receivedFields.map(f => f.name)).to.include.members(['id', 'name'])
  })

  it('should not attach .sql to the stream when returnFinalSqlQuery is disabled', async function () {
    const dbNoSql = createTestConnection({ returnFinalSqlQuery: false })
    await dbNoSql.query(`INSERT INTO ${TEST_TABLE} (name) VALUES (?)`, ['No SQL Test'])

    const stream = dbNoSql
      .query(`SELECT * FROM ${TEST_TABLE} ORDER BY id`)
      .stream()

    for await (const row of stream) {
      void row
    }

    expect(stream).to.not.have.property('sql')
    await closeConnection(dbNoSql)
  })

  it('should emit a connect error on the stream when the connection cannot be established', async function () {
    // Port 1 on localhost gives ECONNREFUSED immediately (no network timeout).
    const badDb = mysql({
      config: { host: '127.0.0.1', port: 1, user: 'root', password: 'password', database: 'test' },
      maxRetries: 0,
    })

    const stream = badDb.query('SELECT 1').stream()
    let caughtErr = null
    try {
      for await (const row of stream) {
        void row
      }
    } catch (err) {
      caughtErr = err
    }

    expect(caughtErr).to.be.an('error')
    expect(stream.destroyed).to.equal(true)
  })
})
