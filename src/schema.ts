import * as z from 'https://deno.land/x/zod@v3.18.0/mod.ts'

export type SchemaGeneric = {
    [field: string]: z.ZodSchema<any, any, any>
}
export type BuildSchemaFieldGeneric = {
    table_name: string
    field_name: string
    encode: z.ZodSchema<any, any, any>
    decode: z.ZodSchema<any, any, any>
}
export type BuildSchemaGeneric = {
    [field: string]: BuildSchemaFieldGeneric
}
export type BuildSchemaField<
  Name extends string,
  Encode extends z.ZodSchema<any, any, any>,
  Decode extends z.ZodSchema<any, any, any>> = {
    table_name: string
    field_name: Name
    encode: Encode
    decode: Decode
}

export type BuildSchema<T extends SchemaGeneric> = 
  BuildSchemaMap<T>
  & { ['*']: ValueOf<BuildSchemaMap<T>> }

type BuildSchemaMap<T extends SchemaGeneric> = {
    [K in keyof T]: {
        table_name: string
        field_name: K
        encode: T[K]
        decode: T[K]
    }
}
type ValueOf<T> = T[keyof T]

function schema<T extends SchemaGeneric>(table_name: string, schema: T) {
    const built_schema: Partial<BuildSchemaMap<T>> = {}
    Object.keys(schema).forEach((field: keyof T) => {
        built_schema[field] = {
            table_name,
            field_name: field,
            encode: schema[field],
            decode: schema[field],
        }
    })
    return built_schema as BuildSchema<T>
}

export type ZodInput<T extends z.ZodSchema<any, any, any>> = T extends z.ZodSchema<infer In, any, any>
    ? In
    : never


export { schema }
