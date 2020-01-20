// Type definitions for serverless-mysql

import * as MySQL from 'mysql'

// https://github.com/microsoft/TypeScript/issues/8335#issuecomment-215194561
declare namespace serverlessMysql {
  export type Config = {
    /**
     * Function mysql library
     */
    library?: Function

    /**
     * Function promise library
     */
    promise?: Function

    /**
     * String or Function  Backoff algorithm to be used when retrying connections. Possible values are full and decorrelated, or you can also specify your own algorithm. See Connection Backoff for more information.  full
     */
    backoff?: string | Function
    /**
     * Integer  Number of milliseconds added to random backoff values.  2
     */
    base?: number
    /**
     * Integer  Maximum number of milliseconds between connection retries.  100
     */
    cap?: number
    /**
     * Object  A mysql configuration object as defined here  {}
     */
    config?: MySQL.ConnectionConfig
    /**
     * Number  The percentage of total connections to use when connecting to your MySQL server. A value of 0.75 would use 75% of your total available connections.  0.8
     */
    connUtilization?: number
    /**
     * Boolean  Flag indicating whether or not you want serverless-mysql to manage MySQL connections for you.  true
     */
    manageConns?: boolean
    /**
     * Integer  The number of milliseconds to cache lookups of @@max_connections.  15000
     */
    maxConnsFreq?: number
    /**
     * Integer  Maximum number of times to retry a connection before throwing an error.  50
     */
    maxRetries?: number
    /**
     * function  Event callback when the MySQL connection fires an error.
     */
    onError?: Function
    /**
     * function  Event callback when MySQL connections are explicitly closed.
     */
    onClose?: Function
    /**
     * function  Event callback when connections are succesfully established.
     */
    onConnect?: Function
    /**
     * function  Event callback when connection fails.
     */
    onConnectError?: Function
    /**
     * function  Event callback when connections are explicitly killed.
     */
    onKill?: Function
    /**
     * function  Event callback when a connection cannot be killed.
     */
    onKillError?: Function
    /**
     * function  Event callback when connections are retried.
     */
    onRetry?: Function
    /**
     * Integer  The number of milliseconds to cache lookups of current connection usage.  0
     */
    usedConnsFreq?: number
    /**
     * Integer  The maximum number of seconds that a connection can stay idle before being recycled.  900
     */
    zombieMaxTimeout?: number
    /**
     * Integer  The minimum number of seconds that a connection must be idle before the module will recycle it.  3
     */
    zombieMinTimeout?: number
  }

  class Transaction {
    query(...args): this
    rollback(fn: Function): this
    commit<T = any>(): Promise<T[]>
  }

  export type ServerlessMysql = {
    connect(wait?: number): Promise<void>
    config(config?: MySQL.ConnectionConfig): MySQL.ConnectionConfig
    query<T>(...args): Promise<T>
    end(): Promise<void>
    escape(str: string): MySQL.EscapeFunctions
    quit(): void
    transaction(): Transaction
    getCounter(): number
    getClient(): MySQL.Connection
    getConfig(): MySQL.ConnectionConfig
    getErrorCount(): number
  }
}

declare function serverlessMysql (cfg?: serverlessMysql.Config): serverlessMysql.ServerlessMysql
export = serverlessMysql
