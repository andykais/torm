import { z } from './dependencies.ts'
import type { Nominal, ExtractFromNominal } from './util.ts'
import type { BuiltSchemaField, SchemaFieldGeneric, SchemaField, SchemaParams, SchemaResult } from './schema.ts'
import type { ZodInput } from './util.ts'



export type ColumnInput =
  | SchemaFieldGeneric
  | SchemaFieldGeneric[]


class Field implements SchemaField {
  table_name: SchemaFieldGeneric['table_name']
  field_name: SchemaFieldGeneric['field_name']
  encode: SchemaFieldGeneric['encode']
  decode: SchemaFieldGeneric['decode']

  public constructor(public schema_field: SchemaField) {
    this.table_name = schema_field.table_name
    this.field_name = schema_field.field_name
    this.encode = schema_field.encode
    this.decode = schema_field.decode
  }
}
export class ParamsField extends Field {}
export class ResultField extends Field {}
