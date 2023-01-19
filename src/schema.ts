import { z } from './dependencies.ts'
import type { Nominal, NominalMapObject, NominalMapUnion, ZodInput, ValueOf } from './util.ts'

export type SchemaInputGeneric = {
    [field: string]: z.ZodSchema<any, any, any>
}
export type SchemaFieldGeneric = Nominal<{
    table_name: string
    field_name: string
    encode: z.ZodSchema<any, any, any>
    decode: z.ZodSchema<any, any, any>
}, 'params' | 'result'>

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
    [K in keyof T]: {
        table_name: string
        field_name: K
        encode: T[K]
        decode: T[K]
    }
}


export type BuiltSchema<T extends SchemaInputGeneric> = 
  BuiltSchemaMap<T>
  & { ['*']: ValueOf<BuiltSchemaMap<T>>[] }


// export type BuiltSchemaParams<T extends SchemaInputGeneric> =
//   NominalMap<BuiltSchemaMap<T>, 'params'>
//   & { ['*']: NominalMap<ValueOf<BuiltSchemaMap<T>>, 'params'> }

// export type BuiltSchemaResult<T extends SchemaInputGeneric> =
//   NominalMap<BuiltSchemaMap<T>, 'result'>
//   & { ['*']: NominalMap<ValueOf<BuiltSchemaMap<T>>, 'result'> }

// export type SchemaParams<T extends SchemaInputGeneric> = BuiltSchemaParams<T>
// export type SchemaResult<T extends SchemaInputGeneric> = BuiltSchemaResult<T>

export type BuiltNominalSchema<T extends SchemaInputGeneric, Identifier> = 
  NominalMapObject<BuiltSchemaMap<T>, Identifier>
  & { ['*']: NominalMapUnion<ValueOf<BuiltSchemaMap<T>>, Identifier> }
export type SchemaParams<T extends SchemaInputGeneric> = BuiltNominalSchema<T, 'params'>
export type SchemaResult<T extends SchemaInputGeneric> = BuiltNominalSchema<T, 'result'>


interface SchemaOutput<T extends SchemaInputGeneric> {
  params: SchemaParams<T>
  result: SchemaResult<T>
}

function schema<T extends SchemaInputGeneric>(table_name: string, schema: T): SchemaOutput<T> {
  const built_schema: Partial<BuiltSchemaMap<T>> = {}
  // TODO add '*'
  Object.keys(schema).forEach((field: keyof T) => {
      built_schema[field] = {
          table_name,
          field_name: field,
          encode: schema[field],
          decode: schema[field],
      }
  })

  const full_schema = built_schema as BuiltSchema<T>
  ;(full_schema as any)['*'] = Object.values(built_schema)
  return {
    params: (full_schema as any) as SchemaParams<T>,
    result: (full_schema as any) as SchemaResult<T>,
  }
}


export { schema }
