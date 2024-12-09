import { ParamsField, ResultField } from './query.ts'
import { schema } from './schema.ts'
import type { Driver, Constructor } from './util.ts'
import type { BuiltSchemaField, SchemaGeneric, SchemaInputGeneric, InferTypes } from './schema.ts'
import type { Statement, StatementParams, StatementResult } from './statement.ts'
import type { SqlTemplateArg, RawSqlInterpolationValues } from './query.ts'
import type { MigrationClass } from './migration.ts'
import type { TormBase } from './torm.ts'

interface ModelClass {
  new (torm: TormBase<Driver>): ModelBase
}

interface ModelInstance {
  prepare_queries: (driver?: Driver) => void
}

interface QueryFn {
  <T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>>
  one: <T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T) => Statement<StatementParams<T>, StatementResult<T>>['one']
  many: <T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T) => Statement<StatementParams<T>, StatementResult<T>>['all']
  exec: <T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T) => Statement<StatementParams<T>, StatementResult<T>>['exec']
}

abstract class ModelBase implements ModelInstance {
  private _torm: TormBase<Driver> | null = null
  private registered_stmts: Statement<any, any>[] = []

  public query: QueryFn

  public constructor(protected torm?: TormBase<Driver>) {
    this.query = this.query_internal as QueryFn
    this.query.exec = this.query_exec.bind(this)
    this.query.many = this.query_many.bind(this)
    this.query.one = this.query_one.bind(this)
  }

  // if torm is not set in the constructor (e.g. like for migrations where we instantiate early for decorators to function)
  public init(torm: TormBase<Driver>) {
    if (this.torm) throw new Error('torm property is already initialized')
    this.torm = torm
  }


  public prepare_queries(driver?: Driver) {
    for (const stmt of this.registered_stmts) {
      stmt.prepare_query(driver ?? this.driver)
    }
  }

  public get driver(): Driver {
    if (!this.torm) throw new Error('internal error: torm was not instantiated on the model')
    return this.torm.driver
  }

  private query_internal<T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>> {
    const stmt = this.build_stmt(strings, ...params)
    this.registered_stmts.push(stmt)
    return stmt
  }

  private query_exec<T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>>['exec'] {
    const stmt = this.build_stmt(strings, ...params)
    this.registered_stmts.push(stmt)
    return stmt.exec
  }

  private query_one<T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>>['one'] {
    const stmt = this.build_stmt(strings, ...params)
    this.registered_stmts.push(stmt)
    return stmt.one
  }

  private query_many<T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>>['all'] {
    const stmt = this.build_stmt(strings, ...params)
    this.registered_stmts.push(stmt)
    return stmt.all
  }

  protected prepare<T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>> {
    const stmt = this.build_stmt(strings, ...params)
    stmt.prepare_query(this.driver)
    return stmt
  }

  protected build_stmt<T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>> {
    const params_fields: SchemaGeneric = {}
    const result_fields: SchemaGeneric = {}

    let sql_string = strings[0]
    for (let index = 1; index < strings.length; index++) {
      const string_part = strings[index]
      const param = params[index - 1]
      // TODO make sure we _only_ do this for our schema values
      // (we should probs wrap the schema_fields in a class SchemaField to make detection easier)
      const column_inputs = this.extract_columns(param, params_fields, result_fields)

      sql_string += column_inputs + string_part
    }

    return this.create_stmt(sql_string, params_fields as StatementParams<T>, result_fields as StatementResult<T>)
  }

  protected abstract create_stmt<Params extends SchemaGeneric, Result extends SchemaGeneric>(sql: string, params: Params, results: Result): Statement<Params, Result>

  private extract_columns(column_input: SqlTemplateArg, params_fields: SchemaGeneric, result_fields: SchemaGeneric) {
    if (Array.isArray(column_input)) {
      const built_columns_sql: string[] = []
      for (const column of column_input) {
        const column_sql = this.build_column_sql(column, params_fields, result_fields)
        built_columns_sql.push(column_sql)
      }
      return this.build_column_array_sql(built_columns_sql)
    } else {
      const column_sql = this.build_column_sql(column_input, params_fields, result_fields)
      return column_sql
    }
  }

  protected build_param_sql(schema_field: ParamsField<any>): string {
    if (schema_field.alias_of) {
      return `:${schema_field.field_name}`
    } else {
      return `:${schema_field.field_name}`
    }
  }

  protected build_result_sql(schema_field: ResultField<any>): string {
    const table_name = schema_field.table_name ? `${schema_field.table_name}.` : ''
    if (schema_field.alias_of) {
      return `${table_name}${schema_field.alias_of} AS '${schema_field.field_name}'`
    } else {
      return `${table_name}${schema_field.field_name}`
    }
  }
  protected build_column_sql(schema_field: BuiltSchemaField<string, any> | RawSqlInterpolationValues, params_fields: SchemaGeneric, result_fields: SchemaGeneric): string {
    if (schema_field instanceof ParamsField) {
      params_fields[schema_field.field_name] = schema_field
      return this.build_param_sql(schema_field)
    } else if (schema_field instanceof ResultField) {
      result_fields[schema_field.field_name] = schema_field
      return this.build_result_sql(schema_field)
    } else {
      switch (typeof schema_field) {
        case 'string':
          return schema_field
        case 'number':
          return `${schema_field}`
        default:
          throw new Error(`Unexpected schema_field ${schema_field}`)
      }
    }
  }

  protected build_column_array_sql(columns_sql: string[]): string {
    return columns_sql.join(', ')
  }
}

export { ModelBase }
export type { ModelClass, ModelInstance }
