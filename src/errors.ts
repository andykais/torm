/**
  * @module
  * This module contains errors that the torm package is expected to throw
  *
  */

export class MigrationError extends Error {}

export class MigrationValidationError extends MigrationError {}

export class QueryError extends Error {
  public override name = 'QueryError'

  public sql: string
  public params: any
  public constructor(sql: string, params: any, message: string) {
    super(message)
    this.sql = sql
    this.params = params
  }
}

export class UniqueConstraintError extends QueryError {
  public override name = 'UniqueConstraintError'
}
