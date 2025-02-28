'use strict'

const NodeURL = require('url')

/**
 * This module manages MySQL connections in serverless applications.
 * More detail regarding the MySQL module can be found here:
 * https://github.com/mysqljs/mysql
 * @author Jeremy Daly <jeremy@jeremydaly.com>
 * @license MIT
 */

module.exports = (params) => {

  // Mutable values
  let client = null // Init null client object
  let counter = 0 // Total reuses counter
  let errors = 0 // Error count
  let retries = 0 // Retry count
  let _cfg = {} // MySQL config globals

  let _maxConns = { updated: 0 } // Cache max connections
  let _usedConns = { updated: 0 } // Cache used connections

  // Common Too Many Connections Errors
  const tooManyConnsErrors = [
    'ER_TOO_MANY_USER_CONNECTIONS',
    'ER_CON_COUNT_ERROR',
    'ER_USER_LIMIT_REACHED',
    'ER_OUT_OF_RESOURCES',
    'PROTOCOL_CONNECTION_LOST', // if the connection is lost
    'PROTOCOL_SEQUENCE_TIMEOUT', // if the connection times out
    'ETIMEDOUT' // if the connection times out
  ]

  // Common Transient Query Errors that can be retried
  const retryableQueryErrors = [
    'ER_LOCK_DEADLOCK', // Deadlock found when trying to get lock
    'ER_LOCK_WAIT_TIMEOUT', // Lock wait timeout exceeded
    'ER_QUERY_INTERRUPTED', // Query execution was interrupted
    'ER_QUERY_TIMEOUT', // Query execution time exceeded
    'ER_CONNECTION_KILLED', // Connection was killed
    'ER_LOCKING_SERVICE_TIMEOUT', // Locking service timeout
    'ER_LOCKING_SERVICE_DEADLOCK', // Locking service deadlock
    'ER_ABORTING_CONNECTION', // Aborted connection
    'PROTOCOL_CONNECTION_LOST', // Connection lost
    'PROTOCOL_SEQUENCE_TIMEOUT', // Connection timeout
    'ETIMEDOUT', // Connection timeout
    'ECONNRESET' // Connection reset
  ]

  // Init setting values
  let MYSQL, manageConns, cap, base, maxRetries, connUtilization, backoff,
    zombieMinTimeout, zombieMaxTimeout, maxConnsFreq, usedConnsFreq,
    onConnect, onConnectError, onRetry, onClose, onError, onKill, onKillError, PromiseLibrary, returnFinalSqlQuery,
    maxQueryRetries, onQueryRetry, queryRetryBackoff

  /********************************************************************/
  /**  HELPER/CONVENIENCE FUNCTIONS                                  **/
  /********************************************************************/

  const getCounter = () => counter
  const incCounter = () => counter++
  const resetCounter = () => counter = 0
  const getClient = () => client
  const resetClient = () => client = null
  const resetRetries = () => retries = 0
  const getErrorCount = () => errors
  const getConfig = () => _cfg
  const config = (args) => {
    if (typeof args === 'string') {
      return Object.assign(_cfg, uriToConnectionConfig(args))
    }
    return Object.assign(_cfg, args)
  }
  const delay = ms => new PromiseLibrary(res => setTimeout(res, ms))
  const randRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const fullJitter = () => randRange(0, Math.min(cap, base * 2 ** retries))
  const decorrelatedJitter = (sleep = 0) => Math.min(cap, randRange(base, sleep * 3))
  const uriToConnectionConfig = (connectionString) => {
    let uri = undefined

    try {
      uri = new NodeURL.URL(connectionString)
    } catch (error) {
      throw new Error('Invalid data source URL provided')
    }

    const extraFields = {}

    for (const [name, value] of uri.searchParams) {
      extraFields[name] = value
    }

    const database = uri.pathname && uri.pathname.startsWith('/') ? uri.pathname.slice(1) : undefined

    const connectionFields = {
      host: uri.hostname ? uri.hostname : undefined,
      user: uri.username ? uri.username : undefined,
      port: uri.port ? Number(uri.port) : undefined,
      password: uri.password ? uri.password : undefined,
      database
    }

    return Object.assign(connectionFields, extraFields)
  }


  /********************************************************************/
  /**  CONNECTION MANAGEMENT FUNCTIONS                               **/
  /********************************************************************/

  // Public connect method, handles backoff and catches
  // TOO MANY CONNECTIONS errors
  const connect = async (wait) => {
    try {
      await _connect()
    } catch (e) {
      if (tooManyConnsErrors.includes(e.code) && retries < maxRetries) {
        retries++
        wait = Number.isInteger(wait) ? wait : 0
        let sleep = backoff === 'decorrelated' ? decorrelatedJitter(wait) :
          typeof backoff === 'function' ? backoff(wait, retries) :
            fullJitter()
        onRetry(e, retries, sleep, typeof backoff === 'function' ? 'custom' : backoff) // fire onRetry event
        await delay(sleep).then(() => connect(sleep))
      } else {
        onConnectError(e) // Fire onConnectError event
        throw new Error(e)
      }
    }
  } // end connect

  // Internal connect method
  const _connect = () => {

    if (client === null) { // if no client connection exists

      resetCounter() // Reset the total use counter

      // Return a new promise
      return new PromiseLibrary((resolve, reject) => {

        // Connect to the MySQL database
        client = MYSQL.createConnection(_cfg)

        // Wait until MySQL is connected and ready before moving on
        client.connect(function (err) {
          if (err) {
            resetClient()
            reject(err)
          } else {
            resetRetries()
            onConnect(client)
            return resolve(true)
          }
        })

        // Add error listener (reset client on failures)
        client.on('error', async err => {
          errors++
          resetClient() // reset client
          resetCounter() // reset counter
          onError(err) // fire onError event (PROTOCOL_CONNECTION_LOST)
        })
      }) // end promise

      // Else the client already exists
    } else {
      return PromiseLibrary.resolve()
    } // end if-else

  } // end _connect


  // Function called at the end that attempts to clean up zombies
  // and maintain proper connection limits
  const end = async () => {

    if (client !== null && manageConns) {

      incCounter() // increment the reuse counter

      // Check the number of max connections
      let maxConns = await getMaxConnections()

      // Check the number of used connections
      let usedConns = await getTotalConnections()

      // If over utilization threshold, try and clean up zombies
      if (usedConns.total / maxConns.total > connUtilization) {

        // Calculate the zombie timeout
        let timeout = Math.min(Math.max(usedConns.maxAge, zombieMinTimeout), zombieMaxTimeout)

        // Kill zombies if they are within the timeout
        let killedZombies = timeout <= usedConns.maxAge ? await killZombieConnections(timeout) : 0

        // If no zombies were cleaned up, close this connection
        if (killedZombies === 0) {
          quit()
        }

        // If zombies exist that are more than the max timeout, kill them
      } else if (usedConns.maxAge > zombieMaxTimeout) {
        await killZombieConnections(zombieMaxTimeout)
      }
    } // end if client
  } // end end() method


  // Function that explicitly closes the MySQL connection.
  const quit = () => {
    if (client !== null) {
      client.end() // Quit the connection.
      resetClient() // reset the client to null
      resetCounter() // reset the reuse counter
      onClose() // fire onClose event
    }
  }


  /********************************************************************/
  /**  QUERY FUNCTIONS                                               **/
  /********************************************************************/

  // Main query function
  const query = async function (...args) {
    // Establish connection
    await connect()

    // Track query retries
    let queryRetries = 0

    // Function to execute the query with retry logic
    const executeQuery = async () => {
      return new PromiseLibrary((resolve, reject) => {
        if (client !== null) {
          // If no args are passed in a transaction, ignore query
          if (this && this.rollback && args.length === 0) { return resolve([]) }

          const queryObj = client.query(...args, async (err, results) => {
            if (returnFinalSqlQuery && queryObj.sql && err) {
              err.sql = queryObj.sql
            }

            if (err && err.code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
              client.destroy() // destroy connection on timeout
              resetClient() // reset the client
              reject(err) // reject the promise with the error
            } else if (
              err && (/^PROTOCOL_ENQUEUE_AFTER_/.test(err.code)
                || err.code === 'PROTOCOL_CONNECTION_LOST'
                || err.code === 'EPIPE'
                || err.code === 'ECONNRESET')
            ) {
              resetClient() // reset the client
              return resolve(query(...args)) // attempt the query again
            } else if (err && retryableQueryErrors.includes(err.code) && queryRetries < maxQueryRetries) {
              // Increment retry counter
              queryRetries++

              // Calculate backoff time
              let wait = 0
              let sleep = queryRetryBackoff === 'decorrelated' ? decorrelatedJitter(wait) :
                typeof queryRetryBackoff === 'function' ? queryRetryBackoff(wait, queryRetries) :
                  fullJitter()

              // Fire onQueryRetry event
              onQueryRetry(err, queryRetries, sleep, typeof queryRetryBackoff === 'function' ? 'custom' : queryRetryBackoff)

              // Wait and retry
              await delay(sleep)
              return resolve(executeQuery())
            } else if (err) {
              if (this && this.rollback) {
                await query('ROLLBACK')
                this.rollback(err)
              }
              reject(err)
            }

            if (returnFinalSqlQuery && queryObj.sql) {
              if (Array.isArray(results)) {
                Object.defineProperty(results, 'sql', {
                  enumerable: false,
                  value: queryObj.sql
                })
              } else if (results && typeof results === 'object') {
                results.sql = queryObj.sql
              }
            }

            return resolve(results)
          })
        }
      })
    }

    // Execute the query with retry logic
    return executeQuery()
  } // end query

  // Change user method
  const changeUser = async (options) => {
    // Ensure we have a connection
    await connect()

    // Return a new promise
    return new PromiseLibrary((resolve, reject) => {
      if (client !== null) {
        // Call the underlying changeUser method
        client.changeUser(options, (err) => {
          if (err) {
            // If connection error, reset client and reject
            if (err.code === 'PROTOCOL_CONNECTION_LOST' ||
              err.code === 'EPIPE' ||
              err.code === 'ECONNRESET') {
              resetClient() // reset the client
              reject(err)
            } else {
              // For other errors, just reject
              reject(err)
            }
          } else {
            // Successfully changed user
            resolve(true)
          }
        })
      } else {
        // No client connection exists
        reject(new Error('No connection available to change user'))
      }
    })
  } // end changeUser

  // Get the max connections (either for this user or total)
  const getMaxConnections = async () => {

    // If cache is expired
    if (Date.now() - _maxConns.updated > maxConnsFreq) {

      let results = await query(
        `SELECT IF(@@max_user_connections > 0,
        LEAST(@@max_user_connections,@@max_connections),
        @@max_connections) AS total,
        IF(@@max_user_connections > 0,true,false) AS userLimit`
      )

      // Update _maxConns
      _maxConns = {
        total: results[0].total || 0,
        userLimit: results[0].userLimit === 1 ? true : false,
        updated: Date.now()
      }

    } // end if renewing cache

    return _maxConns

  } // end getMaxConnections


  // Get the total connections being used and the longest sleep time
  const getTotalConnections = async () => {

    // If cache is expired
    if (Date.now() - _usedConns.updated > usedConnsFreq) {

      let results = await query(
        `SELECT COUNT(ID) as total, MAX(time) as max_age
        FROM information_schema.processlist
        WHERE (user = ? AND @@max_user_connections > 0) OR true`, [_cfg.user])

      _usedConns = {
        total: results[0].total || 0,
        maxAge: results[0].max_age || 0,
        updated: Date.now()
      }

    } // end if refreshing cache

    return _usedConns

  } // end getTotalConnections


  // Kill all zombie connections that are older than the threshold
  const killZombieConnections = async (timeout) => {

    let killedZombies = 0

    // Hunt for zombies (just the sleeping ones that this user owns)
    let zombies = await query(
      `SELECT ID,time FROM information_schema.processlist
        WHERE command = 'Sleep' AND time >= ? AND user = ?
        ORDER BY time DESC`,
      [!isNaN(timeout) ? timeout : 60 * 15, _cfg.user])

    // Kill zombies
    for (let i = 0; i < zombies.length; i++) {
      try {
        await query('KILL ?', zombies[i].ID)
        onKill(zombies[i]) // fire onKill event
        killedZombies++
      } catch (e) {
        // if (e.code !== 'ER_NO_SUCH_THREAD') console.log(e)
        onKillError(e) // fire onKillError event
      }
    } // end for

    return killedZombies

  } // end killZombieConnections


  /********************************************************************/
  /**  TRANSACTION MANAGEMENT                                        **/
  /********************************************************************/

  // Init a transaction object and return methods
  const transaction = () => {

    let queries = [] // keep track of queries
    let rollback = () => { } // default rollback event

    return {
      query: function (...args) {
        if (typeof args[0] === 'function') {
          queries.push(args[0])
        } else {
          queries.push(() => [...args])
        }
        return this
      },
      rollback: function (fn) {
        if (typeof fn === 'function') { rollback = fn }
        return this
      },
      commit: async function () { return await commit(queries, rollback) }
    }
  }

  // Commit transaction by running queries
  const commit = async (queries, rollback) => {

    let results = [] // keep track of results

    // Start a transaction
    await query('START TRANSACTION')

    // Loop through queries
    for (let i = 0; i < queries.length; i++) {
      // Execute the queries, pass the rollback as context
      let result = await query.apply({ rollback }, queries[i](results[results.length - 1], results))
      // Add the result to the main results accumulator
      results.push(result)
    }

    // Commit our transaction
    await query('COMMIT')

    // Return the results
    return results
  }


  /********************************************************************/
  /**  INITIALIZATION                                                **/
  /********************************************************************/
  const cfg = typeof params === 'object' && !Array.isArray(params) ? params : {}

  MYSQL = cfg.library || require('mysql2')
  PromiseLibrary = cfg.promise || Promise

  // Set defaults for connection management
  manageConns = cfg.manageConns === false ? false : true // default to true
  cap = Number.isInteger(cfg.cap) ? cfg.cap : 100 // default to 100 ms
  base = Number.isInteger(cfg.base) ? cfg.base : 2 // default to 2 ms
  maxRetries = Number.isInteger(cfg.maxRetries) ? cfg.maxRetries : 50 // default to 50 attempts
  backoff = typeof cfg.backoff === 'function' ? cfg.backoff :
    cfg.backoff && ['full', 'decorrelated'].includes(cfg.backoff.toLowerCase()) ?
      cfg.backoff.toLowerCase() : 'full' // default to full Jitter
  connUtilization = !isNaN(cfg.connUtilization) ? cfg.connUtilization : 0.8 // default to 0.7
  zombieMinTimeout = Number.isInteger(cfg.zombieMinTimeout) ? cfg.zombieMinTimeout : 3 // default to 3 seconds
  zombieMaxTimeout = Number.isInteger(cfg.zombieMaxTimeout) ? cfg.zombieMaxTimeout : 60 * 15 // default to 15 minutes
  maxConnsFreq = Number.isInteger(cfg.maxConnsFreq) ? cfg.maxConnsFreq : 15 * 1000 // default to 15 seconds
  usedConnsFreq = Number.isInteger(cfg.usedConnsFreq) ? cfg.usedConnsFreq : 0 // default to 0 ms
  returnFinalSqlQuery = cfg.returnFinalSqlQuery === true // default to false

  // Query retry settings
  maxQueryRetries = Number.isInteger(cfg.maxQueryRetries) ? cfg.maxQueryRetries : 0 // default to 0 attempts (disabled for backward compatibility)
  queryRetryBackoff = typeof cfg.queryRetryBackoff === 'function' ? cfg.queryRetryBackoff :
    cfg.queryRetryBackoff && ['full', 'decorrelated'].includes(cfg.queryRetryBackoff.toLowerCase()) ?
      cfg.queryRetryBackoff.toLowerCase() : 'full' // default to full Jitter

  // Event handlers
  onConnect = typeof cfg.onConnect === 'function' ? cfg.onConnect : () => { }
  onConnectError = typeof cfg.onConnectError === 'function' ? cfg.onConnectError : () => { }
  onRetry = typeof cfg.onRetry === 'function' ? cfg.onRetry : () => { }
  onClose = typeof cfg.onClose === 'function' ? cfg.onClose : () => { }
  onError = typeof cfg.onError === 'function' ? cfg.onError : () => { }
  onKill = typeof cfg.onKill === 'function' ? cfg.onKill : () => { }
  onKillError = typeof cfg.onKillError === 'function' ? cfg.onKillError : () => { }
  onQueryRetry = typeof cfg.onQueryRetry === 'function' ? cfg.onQueryRetry : () => { }

  let connCfg = {}

  const isConfigAnObject = typeof cfg.config === 'object' && !Array.isArray(cfg.config)
  const isConfigAString = typeof cfg.config === 'string'

  if (isConfigAnObject || isConfigAString) {
    connCfg = cfg.config
  } else if (typeof params === 'string') {
    connCfg = params
  }

  let escape = MYSQL.escape
  let escapeId = MYSQL.escapeId
  let format = MYSQL.format

  // Set MySQL configs
  config(connCfg)


  // Return public methods
  return {
    connect,
    config,
    query,
    end,
    escape,
    escapeId,
    format,
    quit,
    transaction,
    getCounter,
    getClient,
    getConfig,
    getErrorCount,
    changeUser
  }

} // end exports
