import { z } from './dependencies.ts'
import type { ValueOf } from './util.ts'
import { ParamsField, ResultField, type Field } from './query.ts'
import type { FieldDefinition } from './field.ts'

export type SchemaInputGeneric = Record<string, FieldDefinition<any, any>>
export type SchemaField = {
  table_name: string
  field_name: string
  data_transformers: FieldDefinition<any, any>
}
export type SchemaFieldGeneric = ParamsField<SchemaField> | ResultField<SchemaField>

export type SchemaGeneric = {
  [field: string]: SchemaFieldGeneric
}

export type BuiltSchemaField<
  Name extends string,
  DT extends FieldDefinition<any, any>
  > = {
    table_name: string
    field_name: Name
    data_transformers: DT
}

type BuiltSchemaMap<T extends SchemaInputGeneric> = {
    [K in Extract<keyof T, string>]: {
        table_name: string
        field_name: K
        data_transformers: T[K]
    }
}


export type BuiltSchema<T extends SchemaInputGeneric> = 
  BuiltSchemaMap<T>
  & { ['*']: ValueOf<BuiltSchemaMap<T>>[] }


type BuiltSchemaParamsMap<T extends SchemaInputGeneric> = {
  [K in keyof T]: {
    table_name: string
    field_name: K
    data_transformers: T[K]
  }
}


export type SchemaParams<T extends SchemaInputGeneric> =
  {
    [K in Extract<keyof T, string>]: ParamsField<BuiltSchemaField<K, T[K]>>
  } & {
    ['*']: ValueOf<{
      [K in Extract<keyof T, string>]: ParamsField<BuiltSchemaField<K, T[K]>>
    }>
  }

export type SchemaResult<T extends SchemaInputGeneric> =
  {
    [K in Extract<keyof T, string>]: ResultField<BuiltSchemaField<K, T[K]>>
  } & {
    ['*']: ValueOf<{
      [K in Extract<keyof T, string>]: ResultField<BuiltSchemaField<K, T[K]>>
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
      data_transformers: schema[field],
      // encode: schema[field],
      // decode: schema[field],
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
