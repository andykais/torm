import type { BuiltSchemaField, SchemaGeneric } from './schema.ts'
import type { Nominal, ZodInput, Merge } from './util.ts'
import type { ColumnInput } from './query.ts'

type ExtractParamsInputs<T> =
  T extends Nominal<BuiltSchemaField<infer Name, any, any>, 'params'>
    ? { [K in Name]: ZodInput<T['encode']> }
    : never

type ExtractResultInputs<T> =
  T extends Nominal<BuiltSchemaField<infer Name, any, any>, 'result'>
    ? { [K in Name]: ZodInput<T['encode']> }
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
}

abstract class StatementBase<Params extends SchemaGeneric, Result extends SchemaGeneric> implements Statement<Params, Result> {

  private get_param(field_name: string) {
    const field = this.params[field_name]
    if (field) return field
    throw new Error(`Field ${field_name} does not exist in params list (${Object.keys(this.params)})`)
  }

  protected encode_params(params: Params) {
    const encoded_params: {[field: string]: any} = {}
    for (const [key, val] of Object.entries(params)) {
      const field = this.get_param(key)
      encoded_params[key] = this.params[key].encode.parse(val)
    }
    return encoded_params
  }

    abstract one(params: Params): Result
    abstract all(params: Params): Result[]
    abstract exec(params: Params): void
    abstract params: Params /* debug only */
    // all: (params: Params) => Result[]
    // exec: (params: Params) => void
}

export { StatementBase }
