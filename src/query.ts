import { z } from './dependencies.ts'
import type { BuiltSchemaField, SchemaFieldGeneric, SchemaField, SchemaParams, SchemaResult } from './schema.ts'
import type { ZodInput } from './util.ts'



export type ColumnInput =
  | SchemaFieldGeneric
  | SchemaFieldGeneric[]


export class Field<T extends SchemaField> implements SchemaField {
  table_name: T['table_name']
  field_name: T['field_name']
  encode: T['encode']
  decode: T['decode']

  public constructor(public schema_field: T) {
    this.table_name = schema_field.table_name
    this.field_name = schema_field.field_name
    this.encode = schema_field.encode
    this.decode = schema_field.decode
  }
}

// the 'type' field is silly, but necessary. Typescript has structural types,
// so it cant tell the difference between ParamsField and ResultField if there are no different properties
export class ParamsField<T extends SchemaField> extends Field<T> {
  type = 'params' as const
}
export class ResultField<T extends SchemaField> extends Field<T> {
  type = 'result' as const
}
