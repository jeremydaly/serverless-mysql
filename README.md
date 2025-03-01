[![Serverless MySQL](https://user-images.githubusercontent.com/2053544/79284452-ac531700-7e88-11ea-8970-81e3e649e00a.png)](https://github.com/jeremydaly/serverless-mysql/)

[![npm](https://img.shields.io/npm/v/serverless-mysql.svg)](https://www.npmjs.com/package/serverless-mysql)
[![npm](https://img.shields.io/npm/l/serverless-mysql.svg)](https://www.npmjs.com/package/serverless-mysql)

### A module for managing MySQL connections at *serverless* scale.

Serverless MySQL is a wrapper for Doug Wilson's amazing **[mysql2](https://github.com/mysqljs/mysql2)** Node.js module. Normally, using the `mysql2` module with Node apps would be just fine. However, serverless functions (like AWS Lambda, Google Cloud Functions, and Azure Functions) scale almost infinitely by creating separate instances for each concurrent user. This is a **MAJOR PROBLEM** for RDBS solutions like MySQL, because available connections can be quickly maxed out by competing functions. Not anymore. 😀

Serverless MySQL adds a connection management component to the `mysql2` module that is designed specifically for use with serverless applications. This module constantly monitors the number of connections being utilized, and then based on your settings, manages those connections to allow thousands of concurrent executions to share them. It will clean up zombies, enforce connection limits per user, and retry connections using trusted backoff algorithms.

In addition, Serverless MySQL also adds modern `async/await` support to the `mysql2` module, eliminating callback hell or the need to wrap calls in promises. It also dramatically simplifies **transactions**, giving you a simple and consistent pattern to handle common workflows.

**NOTE:** This module *should* work with any standards-based MySQL server. It has been tested with AWS's RDS MySQL, Aurora MySQL, and Aurora Serverless.

## Simple Example

```javascript
// Require and initialize outside of your main handler
const mysql = require('serverless-mysql')({
  config: {
    host     : process.env.ENDPOINT,
    database : process.env.DATABASE,
    user     : process.env.USERNAME,
    password : process.env.PASSWORD
  }
})

// Main handler function
exports.handler = async (event, context) => {
  // Run your query
  let results = await mysql.query('SELECT * FROM table')

  // Run clean up function
  await mysql.end()

  // Return the results
  return results
}
```

## Logging SQL Queries

You can enable logging of the final SQL query (with all parameter values substituted) by setting the `returnFinalSqlQuery` option to `true`:

```javascript
// Require and initialize outside of your main handler
const mysql = require('serverless-mysql')({
  config: {
    host     : process.env.ENDPOINT,
    database : process.env.DATABASE,
    user     : process.env.USERNAME,
    password : process.env.PASSWORD
  },
  returnFinalSqlQuery: true // Enable SQL query logging
})

// Main handler function
exports.handler = async (event, context) => {
  // Run your query with parameters
  const results = await mysql.query('SELECT * FROM users WHERE id = ?', [userId])
  
  // Access the SQL query with substituted values
  console.log('Executed query:', results.sql)
  
  // Run clean up function
  await mysql.end()

  // Return the results
  return results
}
```

When `returnFinalSqlQuery` is enabled, the SQL query with substituted values is also attached to error objects when a query fails, making it easier to debug:

```javascript
try {
  const results = await mysql.query('SELECT * FROM nonexistent_table')
} catch (error) {
  // The error object will have the SQL property
  console.error('Failed query:', error.sql)
  console.error('Error message:', error.message)
}
```

## Installation
```
npm i serverless-mysql
```

## Requirements
- Node 8.10+
- MySQL server/cluster

## Considerations for this module
- Return promises for easy async request handling
- Exponential backoff (using [Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)) to handle failed connections
- Monitor active connections and disconnect if more than X% of connections are being used
- Support transactions
- Support JIT connections
- Assume AWS endorsed best practices from [here](https://github.com/aws-samples/aws-appsync-rds-aurora-sample/blob/master/src/lamdaresolver/index.js)

## How to use this module
Serverless MySQL wraps the **[mysql](https://github.com/mysqljs/mysql)** module, so this module supports pretty much everything that the `mysql2` module does. It uses all the same [connection options](https://github.com/mysqljs/mysql#connection-options), provides a `query()` method that accepts the same arguments when [performing queries](https://github.com/mysqljs/mysql#performing-queries) (except the callback), and passes back the query results exactly as the `mysql2` module returns them. There are a few things that don't make sense in serverless environments, like streaming rows, so there is no support for that yet.

To use Serverless MySQL, require it **OUTSIDE** your main function handler. This will allow for connection reuse between executions. The module must be initialized before its methods are available. [Configuration options](#configuration-options) must be passed in during initialization.

```javascript
// Require and initialize with default options
const mysql = require('serverless-mysql')() // <-- initialize with function call

// OR include configuration options
const mysql = require('serverless-mysql')({
  backoff: 'decorrelated',
  base: 5,
  cap: 200
})
```

MySQL [connection options](https://github.com/mysqljs/mysql#connection-options) can be passed in at initialization or later using the `config()` method.

```javascript
mysql.config({
  host     : process.env.ENDPOINT,
  database : process.env.DATABASE,
  user     : process.env.USERNAME,
  password : process.env.PASSWORD
})
```

You can explicitly establish a connection using the `connect()` method if you want to, though it isn't necessary. This method returns a promise, so you'll need to `await` the response or wrap it in a promise chain.

```javascript
await mysql.connect()
```

Running queries is super simple using the `query()` method. It supports all [query options](https://github.com/mysqljs/mysql#performing-queries) supported by the `mysql2` module, but returns a promise instead of using the standard callbacks. You either need to `await` them or wrap them in a promise chain.

```javascript
// Simple query
let results = await query('SELECT * FROM table')

// Query with placeholder values
let results = await query('SELECT * FROM table WHERE name = ?', ['serverless'])

// Query with advanced options
let results = await query({
  sql: 'SELECT * FROM table WHERE name = ?',
  timeout: 10000,
  values: ['serverless']
})
```

Once you've run all your queries and your serverless function is ready to return data, call the `end()` method to perform connection management. This will do things like check the current number of connections, clean up zombies, or even disconnect if there are too many connections being used. Be sure to `await` its results before continuing.

```javascript
// Perform connection management tasks
await mysql.end()
```

Note that `end()` will **NOT** necessarily terminate the connection. Only if it has to to manage the connections. If you'd like to explicitly terminate connections, use the `quit()` method.

```javascript
// Gracefully terminate the connection
mysql.quit()
```

If you need access to the `connection` object, you can use the `getClient()` method. This will allow you to use any supported feature of the `mysql2` module directly.

```javascript
// Connect to your MySQL instance first
await mysql.connect()
// Get the connection object
let connection = mysql.getClient()

// Use it to escape a value
let value = connection.escape('Some value to be escaped')
```

You can change the user of an existing connection using the `changeUser()` method. This is useful when you need to switch to a different MySQL user with different permissions.

```javascript
// Change to a different user
await mysql.changeUser({
  user: 'newuser',
  password: 'newpassword'
})

// Now queries will be executed as the new user
let results = await mysql.query('SELECT * FROM restricted_table')
```

You can also use the `changeUser()` method to change the current database, which is equivalent to the `USE DATABASE` SQL statement:

```javascript
// Change to a different database
await mysql.changeUser({
  database: 'new_database'  // Change the database only
})

// Now queries will be executed against the new database
let results = await mysql.query('SELECT * FROM new_database_table')
```

Alternatively, you can use the standard SQL `USE DATABASE` statement with the `query()` method:

```javascript
// Change to a different database using SQL
await mysql.query('USE new_database')

// Now queries will be executed against the new database
let results = await mysql.query('SELECT * FROM new_database_table')
```

## Configuration Options

There are two ways to provide a configuration.

The one way is using a connection string at initialization time.

```javascript
const mysql = require('serverless-mysql')(`mysql://${process.env.USERNAME}:${process.env.PASSWORD}@${process.env.ENDPOINT}:${process.env.PORT}/${process.env.DATABASE}`)
```

The other way is to pass in the options defined in the below table.

Below is a table containing all of the possible configuration options for `serverless-mysql`. Additional details are provided throughout the documentation.

| Property | Type | Description | Default |
| -------- | ---- | ----------- | ------- |
| library | `Function` | Custom mysql library | `require('mysql2')` |
| promise | `Function` | Custom promise library | `Promise` |
| backoff | `String` or `Function` | Backoff algorithm to be used when retrying connections. Possible values are `full` and `decorrelated`, or you can also specify your own algorithm. See [Connection Backoff](#connection-backoff) for more information.  | `full` |
| base | `Integer` | Number of milliseconds added to random backoff values. | `2` |
| cap | `Integer` | Maximum number of milliseconds between connection retries. | `100` |
| config | `Object` | A `mysql2` configuration object as defined [here](https://github.com/mysqljs/mysql#connection-options) | `{}` |
| connUtilization | `Number` | The percentage of total connections to use when connecting to your MySQL server. A value of `0.75` would use 75% of your total available connections. | `0.8` |
| manageConns | `Boolean` | Flag indicating whether or not you want `serverless-mysql` to manage MySQL connections for you. | `true` |
| maxConnsFreq | `Integer` | The number of milliseconds to cache lookups of @@max_connections. | `15000` |
| maxRetries | `Integer` | Maximum number of times to retry a connection before throwing an error. | `50` |
| onError | `function` | [Event](#events) callback when the MySQL connection fires an error. | |
| onClose | `function` | [Event](#events) callback when MySQL connections are explicitly closed. | |
| onConnect | `function` | [Event](#events) callback when connections are succesfully established. | |
| onConnectError | `function` | [Event](#events) callback when connection fails. | |
| onKill | `function` | [Event](#events) callback when connections are explicitly killed. | |
| onKillError | `function` | [Event](#events) callback when a connection cannot be killed. | |
| onRetry | `function` | [Event](#events) callback when connections are retried. | |
| usedConnsFreq | `Integer` | The number of milliseconds to cache lookups of current connection usage. | `0` |
| zombieMaxTimeout | `Integer` | The maximum number of seconds that a connection can stay idle before being recycled. | `900` |
| zombieMinTimeout | `Integer` | The minimum number of *seconds* that a connection must be idle before the module will recycle it. | `3` |
| returnFinalSqlQuery | `Boolean` | Flag indicating whether to attach the final SQL query (with substituted values) to the results. When enabled, the SQL query will be available as a non-enumerable `sql` property on array results or as a regular property on object results. | `false` |
| maxQueryRetries | `Integer` | Maximum number of times to retry a query before giving up. | `0` |
| queryRetryBackoff | `String` or `Function` | Backoff algorithm to be used when retrying queries. Possible values are `full` and `decorrelated`, or you can also specify your own algorithm. See [Connection Backoff](#connection-backoff) for more information. | `full` |
| onQueryRetry | `function` | [Event](#events) callback when queries are retried. | |

### Connection Backoff
If `manageConns` is not set to `false`, then this module will automatically kill idle connections or disconnect the current connection if the `connUtilization` limit is reached. Even with this aggressive strategy, it is possible that multiple functions will be competing for available connections. The `backoff` setting uses the strategy outlined [here](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) to use *Jitter* instead of *Exponential Backoff* when attempting connection retries.

The two supported methods are `full` and `decorrelated` Jitter. Both are effective in reducing server strain and minimize retries. The module defaults to `full`.

**Full Jitter:** LESS work, MORE time
```javascript
sleep = random_between(0, min(cap, base * 2 ** attempts))
```

**Decorrelated Jitter:** MORE work, LESS time
```javascript
sleep = min(cap, random_between(base, sleep * 3))
```

In addition to the two built-in algorithms, you can also provide your own by setting the value of `backoff` to an anonymous function. The function will receive the last `wait` value (how long the previous connection delay was) and `retries`