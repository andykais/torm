import * as z from 'https://deno.land/x/zod@v3.18.0/mod.ts'
import type { BuildSchemaField, BuildSchemaFieldGeneric } from './schema.ts'

type AllKeys<T> = T extends any ? keyof T : never;
type PickType<T, K extends AllKeys<T>> = T extends { [k in K]?: any }
    ? T[K]
    : never;
type Merge<T extends object> = {
  [k in AllKeys<T>]: PickType<T, k>;
}

type StatementParams<T extends ColumnInput[]> =
    Merge<
      T extends Array<infer G>
        ? G extends Array<infer B>
          ? B extends BuildSchemaField<infer Name, any, any>
              ? { [K in Name]: ZodInput<B['encode']> }
              : never
          : G extends BuildSchemaField<infer Name, any, any>
            ? { [K in Name]: ZodInput<G['encode']> }
            : boolean
        : never
    >


type ColumnInput =
  | BuildSchemaFieldGeneric
  | BuildSchemaFieldGeneric[]
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

type ZodSchema<In, Out> = (param: In) => Out
type ZodInput<T extends z.ZodSchema<any, any, any>> = T extends z.ZodSchema<infer In, any, any>
    ? In
    : never

export { query }
