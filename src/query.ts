import { z } from './util.ts'
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

type StatementParams<T extends ColumnInput[]> =
    Merge<
      T extends Array<infer G>
        ? G extends Array<infer B>
          ? B extends BuiltSchemaField<infer Name, any, any>
              ? { [K in Name]: ZodInput<B['encode']> }
              : never
          : G extends BuiltSchemaField<infer Name, any, any>
            ? { [K in Name]: ZodInput<G['encode']> }
            : never
        : never
    >


type ColumnInput =
  | SchemaFieldGeneric
  | SchemaFieldGeneric[]
function query<T extends ColumnInput[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, {}> {
    return {
        one:  (params: {}) => ({}),
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
