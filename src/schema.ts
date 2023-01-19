import { z } from './dependencies.ts'
import type { Nominal, NominalMapObject, NominalMapUnion, ZodInput, ValueOf } from './util.ts'
import { ParamsField, ResultField, type Field } from './query.ts'

export type SchemaInputGeneric = Record<string, z.ZodSchema<any, any, any>>
// export type SchemaInputGeneric = {
//     [field: string]: z.ZodSchema<any, any, any>
// }
export type SchemaField = {
  table_name: string
  field_name: string
  encode: z.ZodSchema<any, any, any>
  decode: z.ZodSchema<any, any, any>
}
// export type SchemaFieldGeneric = Nominal<SchemaField, 'params' | 'result'>
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
// export type BuiltSchemaParams<T extends SchemaInputGeneric> =
//   BuiltSchemaParamsMap<T>

// export type BuiltSchemaParams<T extends SchemaInputGeneric> =
//   NominalMap<BuiltSchemaMap<T>, 'params'>
//   & { ['*']: NominalMap<ValueOf<BuiltSchemaMap<T>>, 'params'> }

// export type BuiltSchemaResult<T extends SchemaInputGeneric> =
//   NominalMap<BuiltSchemaMap<T>, 'result'>
//   & { ['*']: NominalMap<ValueOf<BuiltSchemaMap<T>>, 'result'> }

// export type SchemaParams<T extends SchemaInputGeneric> = BuiltSchemaParams<T>
// export type SchemaResult<T extends SchemaInputGeneric> = BuiltSchemaResult<T>

// I dont know if I can make a reusable type here. I almost wish I had macros I could write
// ...they would be more efficient I think and reusable
// helper map unions
export type MapUnionToParamsFieldInstance<T extends SchemaField> = T extends any ? ParamsField<T> : never
export type MapUnionToResultFieldInstance<T extends SchemaField> = T extends any ? ResultField<T> : never
// helper map objects
export type MapObjectToParamsFieldInstance<T extends BuiltSchemaMap<any>> = { [K in keyof T]: ParamsField<T[K]> }
export type MapObjectToResultFieldInstance<T extends BuiltSchemaMap<any>> = { [K in keyof T]: ResultField<T[K]> }
// helper map all
export type SchemaParams<T extends SchemaInputGeneric> =
  MapObjectToParamsFieldInstance<BuiltSchemaMap<T>>
  & { ['*']: MapUnionToParamsFieldInstance<ValueOf<BuiltSchemaMap<T>>> }
export type SchemaResult<T extends SchemaInputGeneric> =
  MapObjectToResultFieldInstance<BuiltSchemaMap<T>>
  & { ['*']: MapUnionToResultFieldInstance<ValueOf<BuiltSchemaMap<T>>> }


// export type BuiltNominalSchema<T extends SchemaInputGeneric, Identifier> = 
//   NominalMapObject<BuiltSchemaMap<T>, Identifier>
//   & { ['*']: NominalMapUnion<ValueOf<BuiltSchemaMap<T>>, Identifier> }
// export type SchemaParams<T extends SchemaInputGeneric> = BuiltNominalSchema<T, 'params'>
// export type SchemaResult<T extends SchemaInputGeneric> = BuiltNominalSchema<T, 'result'>


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

  // const full_schema = built_schema as BuiltSchema<T>
  // ;(full_schema as any)['*'] = Object.values(built_schema)
  // return {
  //   params: (full_schema as any) as SchemaParams<T>,
  //   result: (full_schema as any) as SchemaResult<T>,
  // }
}


export { schema }
