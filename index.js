'use strict'

/**
 * This module manages MySQL connections in serverless applications.
 * More detail regarding the MySQL module can be found here:
 * https://github.com/mysqljs/mysql
 * @author Jeremy Daly <jeremy@jeremydaly.com>
 * @version 1.5.4
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
    'ER_CON_COUNT_ERROR',
    'PROTOCOL_CONNECTION_LOST', // if the connection is lost
    'PROTOCOL_SEQUENCE_TIMEOUT', // if the connection times out
    'ETIMEDOUT' // if the connection times out
  ]

  // Init setting values
  let MYSQL, manageConns, cap, base, maxRetries, connUtilization, backoff,
    zombieMinTimeout, zombieMaxTimeout, maxConnsFreq, usedConnsFreq,
    onConnect, onConnectError, onRetry, onClose, onError, onKill, onKillError, PromiseLibrary

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
  const config = (args) => Object.assign(_cfg,args)
  const delay = ms => new PromiseLibrary(res => setTimeout(res, ms))
  const randRange = (min,max) => Math.floor(Math.random() * (max - min + 1)) + min
  const fullJitter = () => randRange(0, Math.min(cap, base * 2 ** retries))
  const decorrelatedJitter = (sleep=0) => Math.min(cap, randRange(base, sleep * 3))


  /********************************************************************/
  /**  CONNECTION MANAGEMENT FUNCTIONS                               **/
  /********************************************************************/

  // Public connect method, handles backoff and catches
  // TOO MANY CONNECTIONS errors
  const connect = async (wait) => {
    try {
      await _connect()
    } catch(e) {
      if (tooManyConnsErrors.includes(e.code) && retries < maxRetries) {
        retries++
        wait = Number.isInteger(wait) ? wait : 0
        let sleep = backoff === 'decorrelated' ? decorrelatedJitter(wait) :
          typeof backoff === 'function' ? backoff(wait,retries) :
            fullJitter()
        onRetry(e,retries,sleep,typeof backoff === 'function' ? 'custom' : backoff) // fire onRetry event
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
        client.connect(function(err) {
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
      if (usedConns.total/maxConns.total > connUtilization) {

        // Calculate the zombie timeout
        let timeout = Math.min(Math.max(usedConns.maxAge,zombieMinTimeout),zombieMaxTimeout)

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
  const query = async function(...args) {

    // Establish connection
    await connect()

    // Run the query
    return new PromiseLibrary((resolve,reject) => {
      if (client !== null) {
        // If no args are passed in a transaction, ignore query
        if (this && this.rollback && args.length === 0) { return resolve([]) }
        client.query(...args, async (err, results) => {
          if (err && err.code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
            client.destroy() // destroy connection on timeout
            resetClient() // reset the client
            reject(err) // reject the promise with the error
          } else if (
            err && (/^PROTOCOL_ENQUEUE_AFTER_/.test(err.code) 
            || err.code === 'PROTOCOL_CONNECTION_LOST' 
            || err.code === 'EPIPE')
          ) {
            resetClient() // reset the client
            return resolve(query(...args)) // attempt the query again
          } else if (err) {
            if (this && this.rollback) {
              await query('ROLLBACK')
              this.rollback(err)
            }
            reject(err)
          }
          return resolve(results)
        })
      }
    })

  } // end query


  // Get the max connections (either for this user or total)
  const getMaxConnections = async () => {

    // If cache is expired
    if (Date.now()-_maxConns.updated > maxConnsFreq) {

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
    if (Date.now()-_usedConns.updated > usedConnsFreq) {

      let results = await query(
        `SELECT COUNT(ID) as total, MAX(time) as max_age
        FROM information_schema.processlist
        WHERE (user = ? AND @@max_user_connections > 0) OR true`,[_cfg.user])

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
      [!isNaN(timeout) ? timeout : 60*15, _cfg.user])

    // Kill zombies
    for (let i = 0; i < zombies.length; i++) {
      try {
        await query('KILL ?',zombies[i].ID)
        onKill(zombies[i]) // fire onKill event
        killedZombies++
      } catch(e) {
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
    let rollback = () => {} // default rollback event

    return {
      query: function(...args) {
        if (typeof args[0] === 'function') {
          queries.push(args[0])
        } else {
          queries.push(() => [...args])
        }
        return this
      },
      rollback: function(fn) {
        if (typeof fn === 'function') { rollback = fn }
        return this
      },
      commit: async function() { return await commit(queries,rollback) }
    }
  }

  // Commit transaction by running queries
  const commit = async (queries,rollback) => {

    let results = [] // keep track of results

    // Start a transaction
    await query('START TRANSACTION')

    // Loop through queries
    for (let i = 0; i < queries.length; i++) {
      // Execute the queries, pass the rollback as context
      let result = await query.apply({rollback},queries[i](results[results.length-1],results))
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

  let cfg = typeof params === 'object' && !Array.isArray(params) ? params : {}

  MYSQL = cfg.library || require('mysql')
  PromiseLibrary = cfg.promise || Promise

  // Set defaults for connection management
  manageConns = cfg.manageConns === false ? false : true // default to true
  cap = Number.isInteger(cfg.cap) ? cfg.cap : 100 // default to 100 ms
  base = Number.isInteger(cfg.base) ? cfg.base : 2 // default to 2 ms
  maxRetries = Number.isInteger(cfg.maxRetries) ? cfg.maxRetries : 50 // default to 50 attempts
  backoff = typeof cfg.backoff === 'function' ? cfg.backoff :
    cfg.backoff && ['full','decorrelated'].includes(cfg.backoff.toLowerCase()) ?
      cfg.backoff.toLowerCase() : 'full' // default to full Jitter
  connUtilization = !isNaN(cfg.connUtilization) ? cfg.connUtilization : 0.8 // default to 0.7
  zombieMinTimeout = Number.isInteger(cfg.zombieMinTimeout) ? cfg.zombieMinTimeout : 3 // default to 3 seconds
  zombieMaxTimeout = Number.isInteger(cfg.zombieMaxTimeout) ? cfg.zombieMaxTimeout : 60*15 // default to 15 minutes
  maxConnsFreq = Number.isInteger(cfg.maxConnsFreq) ? cfg.maxConnsFreq : 15*1000 // default to 15 seconds
  usedConnsFreq = Number.isInteger(cfg.usedConnsFreq) ? cfg.usedConnsFreq : 0 // default to 0 ms

  // Event handlers
  onConnect = typeof cfg.onConnect === 'function' ? cfg.onConnect : () => {}
  onConnectError = typeof cfg.onConnectError === 'function' ? cfg.onConnectError : () => {}
  onRetry = typeof cfg.onRetry === 'function' ? cfg.onRetry : () => {}
  onClose = typeof cfg.onClose === 'function' ? cfg.onClose : () => {}
  onError = typeof cfg.onError === 'function' ? cfg.onError : () => {}
  onKill = typeof cfg.onKill === 'function' ? cfg.onKill : () => {}
  onKillError = typeof cfg.onKillError === 'function' ? cfg.onKillError : () => {}

  let connCfg = typeof cfg.config === 'object' && !Array.isArray(cfg.config) ? cfg.config : {}
  let escape = MYSQL.escape
  // Set MySQL configs
  config(connCfg)


  // Return public methods
  return {
    connect,
    config,
    query,
    end,
    escape,
    quit,
    transaction,
    getCounter,
    getClient,
    getConfig,
    getErrorCount
  }

} // end exports
