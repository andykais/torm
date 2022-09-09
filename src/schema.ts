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
export type BuildSchema<T extends SchemaGeneric> = {
    [K in keyof T]: {
        table_name: string
        field_name: K
        encode: T[K]
        decode: T[K]
    }
}


function schema<T extends SchemaGeneric>(table_name: string, schema: T) {
    const built_schema: Partial<BuildSchema<T>> = {}
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

export { schema }
