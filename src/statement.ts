import * as z from 'zod'
import type { BuiltSchemaField, SchemaGeneric } from './schema.ts'
import type { Merge, OptionalKeys } from './util.ts'
import type { SqlTemplateArg, ParamsField, ResultField } from './query.ts'
import type { Driver, OptionalOnEmpty } from './util.ts'
import type { FieldInput, FieldOutput } from './field.ts'

type ExtractParamsInputs<T> =
  T extends ParamsField<BuiltSchemaField<infer Name, any>>
    ? { [K in Name]: FieldInput<T['data_transformers']> }
    : never

type ExtractResultInputs<T> =
  T extends ResultField<BuiltSchemaField<infer Name, any>>
    ? { [K in Name]: FieldOutput<T['data_transformers']> } // params and results should both spit out In rather than Out
    : never

export type StatementParams<T extends SqlTemplateArg[]> =
    OptionalKeys<
      Merge<
        T extends Array<infer G>
          ? G extends Array<infer B>
            ? ExtractParamsInputs<B>
            : ExtractParamsInputs<G>
          : never
      >
    >

export type StatementResult<T extends SqlTemplateArg[]> =
    Merge<
      T extends Array<infer G>
        ? G extends Array<infer B>
          ? ExtractResultInputs<B>
          : ExtractResultInputs<G>
        : never
    >


type ColumnValue = string | number | bigint | Uint8Array | null;
export interface RawRowData {
  [field_name: string]: ColumnValue
}

interface ExecInfo {
  // TODO this is sqlite specific
  last_insert_row_id: number
  changes: number
}

export interface Statement<Params extends SchemaGeneric, Result extends SchemaGeneric> {
    sql: string

    one: (...[params]: OptionalOnEmpty<Params>) => Result | undefined
    all: (...[params]: OptionalOnEmpty<Params>) => Result[]
    exec: (...[params]: OptionalOnEmpty<Params>) => ExecInfo
    params: Params /* debug only */
    result: Result /* debug only */

    prepare_query(driver: Driver): void
}

interface EncodedParams {
  [field: string]: any
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

  protected get driver(): Driver {
    if (this._driver) return this._driver
    else throw new Error('A statement driver cannot be used until init() is called')
  }
  protected get stmt(): DriverStatement {
    if (this._stmt) return this._stmt
    else throw new Error('A statement cannot be used until init() is called')
  }

  protected encode_params = (params: Params | undefined): EncodedParams => {
    const encoded_params: {[field: string]: any} = {}
    for (const field of Object.values(this.params)) {
      const val = params ? params[field.field_name] : undefined
      try {
        encoded_params[field.field_name] = field.data_transformers.call_encode(val)
      } catch (e) {
        if (e instanceof z.ZodError) {
          const message = e.format()._errors.join(',')
          throw new TypeError(`${message} on column ${field.table_name}.${field.field_name}:\n${Deno.inspect(params, { colors: true })}`)
        } else {
          throw e
        }
      }
    }
    return encoded_params
  }

  protected decode_result = (result: RawRowData): Result => {
    const decoded_result: {[field: string]: any} = {}
    for (const [field_name, val] of Object.entries(result)) {
      const field = this.get_result_field(field_name)
      try {
        const field = this.get_result_field(field_name)
        decoded_result[field_name] = field.data_transformers.call_decode(val)
        // if (field.data_transformers.decode) {
        //   decoded_result[field_name] = field.data_transformers.decode(val)
        // } else {
        //   decoded_result[field_name] = val
        // }
      } catch (e) {
        if (e instanceof z.ZodError) {
          const message = e.format()._errors.join(',')
          throw new TypeError(`${message} on column ${field.table_name}.${field.field_name}:\n${Deno.inspect(result, { colors: true })}`)
        } else {
          throw e
        }
      }
    }
    // I dont know how to convert these partial types into full types, so we just cast here
    return decoded_result as Result
  }

  abstract one(...[params]: OptionalOnEmpty<Params>): Result | undefined
  abstract all(...[params]: OptionalOnEmpty<Params>): Result[]
  abstract exec(...[params]: OptionalOnEmpty<Params>): ExecInfo
  protected abstract prepare(sql: string): DriverStatement

  public prepare_query(driver: Driver) {
    this._driver = driver
    try {
      this._stmt = this.prepare(this.sql)
    } catch (e) {
      if (e instanceof Error === false) throw e
      throw new Error(`${e.message}
${'```'}
${this.sql}
${'```'}`, {
  cause: e
})
    }
  }

  public constructor(public sql: string, public params: Params, public result: Result) {}

}

export { StatementBase }
