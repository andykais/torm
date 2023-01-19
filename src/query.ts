import { z } from './deps.ts'
import type { BuiltSchemaField, SchemaFieldGeneric, SchemaField, SchemaParams, SchemaResult } from './schema.ts'



export type ColumnInput =
  | SchemaFieldGeneric
  | SchemaFieldGeneric[]


export class Field<T extends SchemaField> implements SchemaField {
  table_name: T['table_name']
  field_name: T['field_name']
  data_transformers: T['data_transformers']

  public constructor(public schema_field: T) {
    this.table_name = schema_field.table_name
    this.field_name = schema_field.field_name
    this.data_transformers = schema_field.data_transformers
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
