import type { BuiltSchemaField, SchemaGeneric } from './schema.ts'
import type { Merge } from './util.ts'
import { ColumnInput, ParamsField, ResultField } from './query.ts'
import type { Driver, Constructor } from './util.ts'
import type { FieldInput } from './field.ts'

type ExtractParamsInputs<T> =
  T extends ParamsField<BuiltSchemaField<infer Name, any>>
    ? { [K in Name]: FieldInput<T['data_transformers']> }
    : never

type ExtractResultInputs<T> =
  T extends ResultField<BuiltSchemaField<infer Name, any>>
    ? { [K in Name]: FieldInput<T['data_transformers']> } // params and results should both spit out In rather than Out
    : never

export type StatementParams<T extends ColumnInput[]> =
    Merge<
      T extends Array<infer G>
        ? G extends Array<infer B>
          ? ExtractParamsInputs<B>
          : ExtractParamsInputs<G>
        : never
    >

export type StatementResult<T extends ColumnInput[]> =
    Merge<
      T extends Array<infer G>
        ? G extends Array<infer B>
          ? ExtractResultInputs<B>
          : ExtractResultInputs<G>
        : never
    >


export interface Statement<Params extends SchemaGeneric, Result extends SchemaGeneric> {
    one: (params: Params) => Result
    all: (params: Params) => Result[]
    exec: (params: Params) => void
    params: Params /* debug only */
    result: Result /* debug only */

    prepare_query(driver: Driver): void
}

abstract class StatementBase<DriverStatement, Params extends SchemaGeneric, Result extends SchemaGeneric> implements Statement<Params, Result> {

  private get_param_field(field_name: string) {
    const field = this.params[field_name]
    if (field) return field
    throw new Error(`Field ${field_name} does not exist in params list (${Object.keys(this.params)})`)
  }
  private get_result_field(field_name: string) {
    const field = this.result[field_name]
    if (field) return field
    throw new Error(`Field ${field_name} does not exist in result list (${Object.keys(this.result)})`)
  }

  protected _stmt: DriverStatement | null = null
  private _driver: Driver | null = null

  protected get driver() {
    if (this._driver) return this._driver
    else throw new Error('A statement driver cannot be used until init() is called')
  }
  protected get stmt(): DriverStatement {
    if (this._stmt) return this._stmt
    else throw new Error('A statement cannot be used until init() is called')
  }

  protected encode_params = (params: Params) => {
    const encoded_params: {[field: string]: any} = {}
    for (const [key, val] of Object.entries(params)) {
      const field = this.get_param_field(key)
      encoded_params[key] = field.data_transformers.encode(val)
    }
    return encoded_params
  }

  protected decode_result = (result: Result): Result => {
    const decoded_result: {[field: string]: any} = {}
    for (const [key, val] of Object.entries(result)) {
      const field = this.get_result_field(key)
      if (field.data_transformers.decode) {
        decoded_result[key] = field.data_transformers.decode(val)
      } else {
        decoded_result[key] = val
      }
    }
    // I dont know how to convert these partial types into full types, so we just cast here
    return decoded_result as Result
  }

  abstract one(params: Params): Result
  abstract all(params: Params): Result[]
  abstract exec(params: Params): void
  protected abstract prepare(sql: string): DriverStatement

  public prepare_query(driver: Driver) {
    this._driver = driver
    this._stmt = this.prepare(this.sql)
  }

  public constructor(public sql: string, public params: Params, public result: Result) {}

}

export { StatementBase }
