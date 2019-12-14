# Serverless MySQL

[![npm](https://img.shields.io/npm/v/serverless-mysql.svg)](https://www.npmjs.com/package/serverless-mysql)
[![npm](https://img.shields.io/npm/l/serverless-mysql.svg)](https://www.npmjs.com/package/serverless-mysql)

### A module for managing MySQL connections at *serverless* scale.

Serverless MySQL is a wrapper for Doug Wilson's amazing **[mysql](https://github.com/mysqljs/mysql)** Node.js module. Normally, using the `mysql` module with Node apps would be just fine. However, serverless functions (like AWS Lambda, Google Cloud Functions, and Azure Functions) scale almost infinitely by creating separate instances for each concurrent user. This is a **MAJOR PROBLEM** for RDBS solutions like MySQL, because available connections can be quickly maxed out by competing functions. Not anymore. 😀

Serverless MySQL adds a connection management component to the `mysql` module that is designed specifically for use with serverless applications. This module constantly monitors the number of connections being utilized, and then based on your settings, manages those connections to allow thousands of concurrent executions to share them. It will clean up zombies, enforce connection limits per user, and retry connections using trusted backoff algorithms.

In addition, Serverless MySQL also adds modern `async/await` support to the `mysql` module, eliminating callback hell or the need to wrap calls in promises. It also dramatically simplifies **transactions**, giving you a simple and consistent pattern to handle common workflows.

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
Serverless MySQL wraps the **[mysql](https://github.com/mysqljs/mysql)** module, so this module supports pretty much everything that the `mysql` module does. It uses all the same [connection options](https://github.com/mysqljs/mysql#connection-options), provides a `query()` method that accepts the same arguments when [performing queries](https://github.com/mysqljs/mysql#performing-queries) (except the callback), and passes back the query results exactly as the `mysql` module returns them. There are a few things that don't make sense in serverless environments, like streaming rows, so there is no support for that yet.

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

Running queries is super simple using the `query()` method. It supports all [query options](https://github.com/mysqljs/mysql#performing-queries) supported by the `mysql` module, but returns a promise instead of using the standard callbacks. You either need to `await` them or wrap them in a promise chain.

```javascript
// Simple query
let results = await query('SELECT * FROM table')

// Query with placeholder values
let results = await query('SELECT * FROM table WHERE name = ?', ['serverless'])

// Query with advanced options
let results = await query({
  sql: 'SELECT * FROM table WHERE name = ?',
  timeout: 10000,
  values: ['serverless'])
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

If you need access to the `connection` object, you can use the `getClient()` method. This will allow you to use any supported feature of the `mysql` module directly.

```javascript
// Connect to your MySQL instance first
await mysql.connect()
// Get the connection object
let connection = mysql.getClient()

// Use it to escape a value
let value = connection.escape('Some value to be escaped')
```

## Configuration Options
Below is a table containing all of the possible configuration options for `serverless-mysql`. Additional details are provided throughout the documentation.

| Property | Type | Description | Default |
| -------- | ---- | ----------- | ------- |
| library | `Function` | Custom mysql library | `require('mysql')` |
| promise | `Function` | Custom promise library | `Promise` |
| backoff | `String` or `Function` | Backoff algorithm to be used when retrying connections. Possible values are `full` and `decorrelated`, or you can also specify your own algorithm. See [Connection Backoff](#connection-backoff) for more information.  | `full` |
| base | `Integer` | Number of milliseconds added to random backoff values. | `2` |
| cap | `Integer` | Maximum number of milliseconds between connection retries. | `100` |
| config | `Object` | A `mysql` configuration object as defined [here](https://github.com/mysqljs/mysql#connection-options) | `{}` |
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

In addition to the two built-in algorithms, you can also provide your own by setting the value of `backoff` to an anonymous function. The function will receive the last `wait` value (how long the previous connection delay was) and `retries` (the number of retries attempted). Your function must return an `Integer` that represents the number of milliseconds to delay the next retry.

```javascript
backoff: (wait,retries) => {
  console.log('CUSTOM BACKOFF',wait,retries)
  return 20 // return integer
}
```

## Custom libraries

Set your own promise library
```javascript
promise: require('bluebird')
```

Set your own mysql library, wrapped with AWS x-ray for instance
```javascript
library: require('aws-sdk-xray-node')(require('mysql'));
```

## Events
The module fires seven different types of events: `onConnect`, `onConnectError`, `onRetry`, `onClose`, `onError`, `onKill`, and `onKillError`. These are *reporting* events that allow you to add logging or perform additional actions. You could use these events to short-circuit your handler execution, but using `catch` blocks is preferred. For example, `onError` and `onKillError` are not fatal and will be handled by `serverless-mysql`. Therefore, they will **NOT** `throw` an error and trigger a `catch` block.

Error events (`onConnectError`, `onError` and `onKillError`) all receive one argument containing the `mysql` module error object.

```javascript
onConnectError: (e) => { console.log('Connect Error: ' + e.code) }
```

The `onConnect` event recieves the MySQL `connection` object, `onKill` receives the `threadId` of the connection killed, and `onClose` doesn't receive any arguments.

`onRetry` receives *four* arguments. The `error` object, the number of `retries`, the `delay` until the next retry, and the `backoff` algorithm used (`full`, `decorrelated` or `custom`).

```javascript
onRetry: (err,retries,delay,type) => { console.log('RETRY') }
```

## MySQL Server Configuration
There really isn't anything special that needs to be done in order for your MySQL server (including RDS, Aurora, and Aurora Serverless) to use `serverless-mysql`. You should just be aware of the following two scenarios.

If you set max `user_connections`, the module will only manage connections for that user. This is useful if you have multiple clients connecting to the same MySQL server (or cluster) and you want to make sure your serverless app doesn't use all of the available connections.

If you're not setting max `user_connections`, the user **MUST BE** granted the `PROCESS` privilege in order to count other connections. Otherwise it will assume that its connections are the only ones being used. Granting `PROCESS` is fairly safe as it is a *read only* permission and doesn't expose any sensitive data.

## Query Timeouts
The `mysql` module allows you to specify a "[timeout](https://github.com/mysqljs/mysql#timeouts)" with each query. Typically this will disconnect the connection and prevent you from running additional queries. `serverless-mysql` handles timeouts a bit more elegantly by throwing an error and `destroy()`ing the connection. This will reset the connection completely, allowing you to run additional queries **AFTER** you catch the error.

## Transaction Support
Transaction support in `serverless-mysql` has been dramatically simplified. Start a new transaction using the `transaction()` method, and then chain queries using the `query()` method. The `query()` method supports all standard query options. Alternatively, you can specify a function as the only argument in a `query()` method call and return the arguments as an array of values. The function receives two arguments, the result of the last query executed and an array containing all the previous query results. This is useful if you need values from a previous query as part of your transaction.

You can specify an optional `rollback()` method in the chain. This will receive the `error` object, allowing you to add additional logging or perform some other action. Call the `commit()` method when you are ready to execute the queries.

```javascript
let results = await mysql.transaction()
  .query('INSERT INTO table (x) VALUES(?)', [1])
  .query('UPDATE table SET x = 1')
  .rollback(e => { /* do something with the error */ }) // optional
  .commit() // execute the queries
```

With a function to get the `insertId` from the previous query:

```javascript
let results = await mysql.transaction()
  .query('INSERT INTO table (x) VALUES(?)', [1])
  .query((r) => ['UPDATE table SET x = 1 WHERE id = ?', r.insertId])
  .rollback(e => { /* do something with the error */ }) // optional
  .commit() // execute the queries
```

You can also return a `null` or empty response from `.query()` calls within a transaction. This lets you perform conditional transactions like this:

```javascript
let results = await mysql.transaction()
  .query('DELETE FROM table WHERE id = ?', [someVar])
  .query((r) => {
    if (r.affectedRows > 0) {
      return ['UPDATE anotherTable SET x = 1 WHERE id = ?', [someVar]]
    } else {
      return null
    }
  })
  .rollback(e => { /* do something with the error */ }) // optional
  .commit() // execute the queries
```

If the record to `DELETE` doesn't exist, the `UPDATE` will not be performed. If the `UPDATE` fails, the `DELETE` will be rolled back.

**NOTE:** Transaction support is designed for InnoDB tables (default). Other table types may not behave as expected.

## Reusing Persistent Connections
If you're using AWS Lambda with **callbacks**, be sure to set `context.callbackWaitsForEmptyEventLoop = false;` in your main handler. This will allow the freezing of connections and will prevent Lambda from hanging on open connections. See [here](https://www.jeremydaly.com/reuse-database-connections-aws-lambda/) for more information. If you are using `async` functions, this is no longer necessary.

## Tests
I've run *a lot* of tests using a number of different configurations. Ramp ups appear to work best, but once there are several warm containers, the response times are much better. Below is an example test I ran using AWS Lambda and Aurora Serverless. Aurora Serverless was configured with *2 ACUs* (and it didn't autoscale), so there were only **90 connections** available to the MySQL cluster. The Lambda function was configured with 1,024 MB of memory. This test simulated **500 users** per second for one minute. Each user ran a sample query retrieving a few rows from a table.

From the graph below you can see that the average response time was **41 ms** (min 20 ms, max 3743 ms) with **ZERO** errors.

![Serverless MySQL test - 500 connections per second w/ 90 connections available](https://www.jeremydaly.com/wp-content/uploads/2018/09/serverless-mysql-test-500users-90-connections.png)

Other tests that use larger configurations were extremely successful too, but I'd appreciate other independent tests to verify my assumptions.

## Contributions
Contributions, ideas and bug reports are welcome and greatly appreciated. Please add [issues](https://github.com/jeremydaly/serverless-mysql/issues) for suggestions and bug reports or create a pull request.

## TODO
- Add `changeUser` support
- Add connection retries on failed queries
- Add automated tests and coverage reports
