import { z } from './util.ts'
import type { Nominal, NominalMapObject, NominalMapUnion, ZodInput, ValueOf } from './util.ts'

export type SchemaGeneric = {
    [field: string]: z.ZodSchema<any, any, any>
}
export type SchemaFieldGeneric = Nominal<{
    table_name: string
    field_name: string
    encode: z.ZodSchema<any, any, any>
    decode: z.ZodSchema<any, any, any>
}, 'params' | 'result'>

export type BuiltSchemaField<
  Name extends string,
  Encode extends z.ZodSchema<any, any, any>,
  Decode extends z.ZodSchema<any, any, any>> = {
    table_name: string
    field_name: Name
    encode: Encode
    decode: Decode
}

type BuiltSchemaMap<T extends SchemaGeneric> = {
    [K in keyof T]: {
        table_name: string
        field_name: K
        encode: T[K]
        decode: T[K]
    }
}


export type BuiltSchema<T extends SchemaGeneric> = 
  BuiltSchemaMap<T>
  & { ['*']: ValueOf<BuiltSchemaMap<T>> }


// export type BuiltSchemaParams<T extends SchemaGeneric> =
//   NominalMap<BuiltSchemaMap<T>, 'params'>
//   & { ['*']: NominalMap<ValueOf<BuiltSchemaMap<T>>, 'params'> }

// export type BuiltSchemaResult<T extends SchemaGeneric> =
//   NominalMap<BuiltSchemaMap<T>, 'result'>
//   & { ['*']: NominalMap<ValueOf<BuiltSchemaMap<T>>, 'result'> }

// export type SchemaParams<T extends SchemaGeneric> = BuiltSchemaParams<T>
// export type SchemaResult<T extends SchemaGeneric> = BuiltSchemaResult<T>

export type BuiltNominalSchema<T extends SchemaGeneric, Identifier> = 
  NominalMapObject<BuiltSchemaMap<T>, Identifier>
  & { ['*']: NominalMapUnion<ValueOf<BuiltSchemaMap<T>>, Identifier> }
export type SchemaParams<T extends SchemaGeneric> = BuiltNominalSchema<T, 'params'>
export type SchemaResult<T extends SchemaGeneric> = BuiltNominalSchema<T, 'result'>


interface SchemaOutput<T extends SchemaGeneric> {
  params: SchemaParams<T>
  result: SchemaResult<T>
}

function schema<T extends SchemaGeneric>(table_name: string, schema: T): SchemaOutput<T> {
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
  return {
    params: (full_schema as any) as SchemaParams<T>,
    result: (full_schema as any) as SchemaResult<T>,
  }
}


export { schema }
