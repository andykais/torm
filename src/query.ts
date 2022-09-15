import { z } from './util.ts'
import type { Nominal } from './util.ts'
import type { BuiltSchemaField, SchemaFieldGeneric, SchemaParams, SchemaResult } from './schema.ts'
import type { ZodInput } from './util.ts'

type AllKeys<T> = T extends any ? keyof T : never;
type PickType<T, K extends AllKeys<T>> = T extends { [k in K]?: any }
    ? T[K]
    : never;
type Merge<T extends object> = {
  [k in AllKeys<T>]: PickType<T, k>;
}
type ValueOf<T> = T[keyof T];

type ExtractParamsInputs<T> =
  T extends Nominal<BuiltSchemaField<infer Name, any, any>, 'params'>
    ? { [K in Name]: ZodInput<T['encode']> }
    : never

type ExtractResultInputs<T> =
  T extends Nominal<BuiltSchemaField<infer Name, any, any>, 'result'>
    ? { [K in Name]: ZodInput<T['encode']> }
    : never

type StatementParams<T extends ColumnInput[]> =
    Merge<
      T extends Array<infer G>
        ? G extends Array<infer B>
          ? ExtractParamsInputs<B>
          : ExtractParamsInputs<G>
        : never
    >

type StatementResult<T extends ColumnInput[]> =
    Merge<
      T extends Array<infer G>
        ? G extends Array<infer B>
          ? ExtractResultInputs<B>
          : ExtractResultInputs<G>
        : never
    >


type ColumnInput =
  | SchemaFieldGeneric
  | SchemaFieldGeneric[]
function query<T extends ColumnInput[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, StatementResult<T>> {
    return {
        one:  (params: {}) => ({} as any),
        all:  (params: {}) => [],
        exec: (params: {}) => {},
        params: {} as StatementParams<T>
    }
}

interface Statement<Params extends {}, Result> {
    one: (params: Params) => Result
    all: (params: Params) => Result[]
    exec: (params: Params) => void
    params: Params
}

export { query }
