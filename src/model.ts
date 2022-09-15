import { ParamsField, ResultField } from './query.ts'
import type { Driver } from './util.ts'
import type { BuiltSchemaField, SchemaGeneric } from './schema.ts'
import type { Statement, StatementParams, StatementResult } from './statement.ts'
import type { ColumnInput } from './query.ts'

abstract class ModelBase {
  public constructor(protected driver: Driver) {

  }

  // TODO rename to 'prepare'?
  query<T extends ColumnInput[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>> {
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

    // TODO fill in params
    const stmt = this.prepare(sql_string, params_fields as StatementParams<T>, result_fields as StatementResult<T>)
    return stmt
    // return {
    //   one:  (params: {}) => ({} as any),
    //   all:  (params: {}) => [],
    //   exec: (params: {}) => {},
    //   params: {} as StatementParams<T>
    // }
  }

  protected abstract prepare<Params extends SchemaGeneric, Result extends SchemaGeneric>(sql: string, params: Params, results: Result): Statement<Params, Result>

  private extract_columns(column_input: ColumnInput, params_fields: SchemaGeneric, result_fields: SchemaGeneric) {
    if (Array.isArray(column_input)) {
      const built_columns_sql: string[] = []
      for (const column of column_input) {
        const column_sql = this.build_column_sql(column)
        params_fields[column.field_name] = column
        built_columns_sql.push(column_sql)
      }
      return this.build_column_array_sql(built_columns_sql)
    } else {
      const column_sql = this.build_column_sql(column_input)
      params_fields[column_input.field_name] = column_input
      return column_sql
    }
  }

  protected build_param_sql(schema_field: BuiltSchemaField<string, any, any>) {
    return `:${schema_field.field_name}`
  }
  protected build_result_sql(schema_field: BuiltSchemaField<string, any, any>) {
    return `${schema_field.table_name}.${schema_field.field_name}`
  }
  protected build_column_sql(schema_field: BuiltSchemaField<string, any, any>) {
    if (schema_field instanceof ParamsField) {
      return this.build_param_sql(schema_field)
    } else {
      return this.build_result_sql(schema_field)
    }
  }

  protected build_column_array_sql(columns_sql: string[]) {
    return columns_sql.join(', ')
  }
}

export { ModelBase }
