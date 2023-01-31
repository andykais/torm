import { ParamsField, ResultField } from './query.ts'
import { schema } from './schema.ts'
import type { Driver, Constructor } from './util.ts'
import type { BuiltSchemaField, SchemaGeneric, SchemaInputGeneric } from './schema.ts'
import { Statement, StatementParams, StatementResult } from './statement.ts'
import type { SqlTemplateArg, RawSqlInterpolationValues } from './query.ts'
import type { MigrationClass } from './migration.ts'
import type { TormBase } from './torm.ts'

interface ModelOptions {
  override_torm_status: boolean
}

interface ModelClass {
  migrations?: typeof ModelBase.migrations
  // new (torm: TormBase<Driver>, options: ModelOptions): ModelBase
  new (torm: TormBase<Driver>): ModelBase
}
interface ModelInstance {
  prepare_queries: (driver?: Driver) => void
}

abstract class ModelBase implements ModelInstance {
  private _torm: TormBase<Driver> | null = null
  private registered_stmts: Statement<any, any>[] = []

  static migrations?: {
    initialization?: MigrationClass
    upgrades?: MigrationClass[]
  }

  // public constructor(protected torm: TormBase<Driver>, private options: ModelOptions) {}
  public constructor(protected torm: TormBase<Driver>) {}

  public prepare_queries(driver?: Driver) {
    for (const stmt of this.registered_stmts) {
      stmt.prepare_query(driver ?? this.driver)
    }
  }

  public get driver() {
    return this.torm.driver
  }

  protected query<T extends SqlTemplateArg[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>> {
    const stmt = this.build_stmt(strings, ...params)
    this.registered_stmts.push(stmt)
    return stmt
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

  protected build_param_sql(schema_field: BuiltSchemaField<string, any>) {
    return `:${schema_field.field_name}`
  }
  protected build_result_sql(schema_field: ResultField<any>) {
    const table_name = schema_field.table_name ? `${schema_field.table_name}.` : ''
    if (schema_field.alias_of) {
      return `${table_name}${schema_field.alias_of} AS '${schema_field.field_name}'`
    } else {
      return `${table_name}${schema_field.field_name}`
    }
  }
  protected build_column_sql(schema_field: BuiltSchemaField<string, any> | RawSqlInterpolationValues, params_fields: SchemaGeneric, result_fields: SchemaGeneric) {
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

  protected build_column_array_sql(columns_sql: string[]) {
    return columns_sql.join(', ')
  }
}

const WithStaticSchema =
  <Class extends Constructor>(base: Class) =>
    <T extends SchemaInputGeneric>(table_name: string, schema_input: T) => {
      return class IncludingStaticSchema extends base {
        static schema = schema(table_name, schema_input)
        static params = IncludingStaticSchema.schema.params
        static result = IncludingStaticSchema.schema.result
      }
    }

export { ModelBase, WithStaticSchema }
export type { ModelClass, ModelInstance }
