/**
  * This module contains errors that the torm package is expected to throw
  *
  * @module
  */

/**
  * An error that occured from within a `Migration::call` command
  */
export class MigrationError extends Error {}

/**
  * An errror with how migrations are registered (e.g. a Migration exists with a newer version than the SeedMigration)
  */
export class MigrationValidationError extends MigrationError {}

/**
  * An error that occurs when running a query declared on a model
  */
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

/**
  * A error that occurred when running a model defined query related to a unique constraint. Useful when using database unique constraints to control business logic.
  */
export class UniqueConstraintError extends QueryError {
  public override name = 'UniqueConstraintError'
}
