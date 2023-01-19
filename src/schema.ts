import { z } from './dependencies.ts'
import type { ZodInput, ValueOf } from './util.ts'
import { ParamsField, ResultField, type Field } from './query.ts'

export type SchemaInputGeneric = Record<string, z.ZodSchema<any, any, any>>
export type SchemaField = {
  table_name: string
  field_name: string
  encode: z.ZodSchema<any, any, any>
  decode: z.ZodSchema<any, any, any>
}
export type SchemaFieldGeneric = ParamsField<SchemaField> | ResultField<SchemaField>

export type SchemaGeneric = {
  [field: string]: SchemaFieldGeneric
}

export type BuiltSchemaField<
  Name extends string,
  Encode extends z.ZodSchema<any, any, any>,
  Decode extends z.ZodSchema<any, any, any>> = {
    table_name: string
    field_name: Name
    encode: Encode
    decode: Decode
}

type BuiltSchemaMap<T extends SchemaInputGeneric> = {
    [K in Extract<keyof T, string>]: {
        table_name: string
        field_name: K
        encode: T[K]
        decode: T[K]
    }
}


export type BuiltSchema<T extends SchemaInputGeneric> = 
  BuiltSchemaMap<T>
  & { ['*']: ValueOf<BuiltSchemaMap<T>>[] }


type BuiltSchemaParamsMap<T extends SchemaInputGeneric> = {
  [K in keyof T]: {
    table_name: string
    field_name: K
    encode: T[K]
    decode: T[K]
  }
}


export type SchemaParams<T extends SchemaInputGeneric> =
  {
    [K in Extract<keyof T, string>]: ParamsField<BuiltSchemaField<K, T[K], T[K]>>
  } & {
    ['*']: ValueOf<{
      [K in Extract<keyof T, string>]: ParamsField<BuiltSchemaField<K, T[K], T[K]>>
    }>
  }

export type SchemaResult<T extends SchemaInputGeneric> =
  {
    [K in Extract<keyof T, string>]: ResultField<BuiltSchemaField<K, T[K], T[K]>>
  } & {
    ['*']: ValueOf<{
      [K in Extract<keyof T, string>]: ResultField<BuiltSchemaField<K, T[K], T[K]>>
    }>
  }


export interface SchemaOutput<T extends SchemaInputGeneric> {
  params: SchemaParams<T>
  result: SchemaResult<T>
}

type KeyOf<T extends object> = Extract<keyof T, string>

function schema<T extends SchemaInputGeneric>(table_name: string, schema: T): SchemaOutput<T> {
  const built_params_schema: Partial<SchemaParams<T>> = {}
  const built_result_schema: Partial<SchemaResult<T>> = {}
  // TODO add '*'
  Object.keys(schema).forEach((field: string) => {
    const schema_field: SchemaField = {
      table_name,
      field_name: field as string,
      encode: schema[field],
      decode: schema[field],
    }
    // TODO make typesafe
    built_params_schema[field as KeyOf<T>] = new ParamsField(schema_field) as any
    built_result_schema[field as KeyOf<T>] = new ResultField(schema_field) as any
  })

  ;(built_params_schema['*'] as any) = Object.values(built_params_schema)
  ;(built_result_schema['*'] as any) = Object.values(built_result_schema)

  return {
    params: built_params_schema as SchemaParams<T>,
    result: built_result_schema as SchemaResult<T>,
  }
}


export { schema }
