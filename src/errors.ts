import { type StatementBase } from './statement.ts'


export class QueryError extends Error {
  public name = 'QueryError'

  public sql: string
  public params: any
  public constructor(sql: string, params: any, message: string) {
    super(message)
    this.sql = sql
    this.params = params
  }
}

export class UniqueConstraintError extends QueryError {
  public name = 'UniqueConstraintError'
}
