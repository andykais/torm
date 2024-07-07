import type { SchemaFieldGeneric, SchemaField } from './schema.ts'



export type ColumnInput =
  | SchemaFieldGeneric
  | SchemaFieldGeneric[]


export type RawSqlInterpolationValues =
  | string
  | number

export type SqlTemplateArg =
  | ColumnInput
  | RawSqlInterpolationValues


type AliasParamsField<T extends SchemaField, Alias extends string> = ParamsField<{
 table_name: T['table_name']
 field_name: Alias
 data_transformers: T['data_transformers'] 
}>

type AliasResultField<T extends SchemaField, Alias extends string> = ResultField<{
 table_name: T['table_name']
 field_name: Alias
 data_transformers: T['data_transformers'] 
}>

export class Field<T extends SchemaField> implements SchemaField {
  table_name: T['table_name']
  field_name: T['field_name']
  data_transformers: T['data_transformers']

  public constructor(public schema_field: T, public alias_of?: string) {
    this.table_name = schema_field.table_name
    this.field_name = schema_field.field_name
    this.data_transformers = schema_field.data_transformers
  }
}

// the 'type' field is silly, but necessary. Typescript has structural types,
// so it cant tell the difference between ParamsField and ResultField if there are no different properties
export class ParamsField<T extends SchemaField> extends Field<T> {
  type = 'params' as const


  public as<A extends string>(alias: A): AliasParamsField<T, A> {
    return new ParamsField({
      table_name: this.table_name,
      field_name: alias,
      data_transformers: this.data_transformers,
    }, this.field_name)
  }
}

export class ResultField<T extends SchemaField> extends Field<T> {
  type = 'result' as const


  public as<A extends string>(alias: A): AliasResultField<T, A> {
    return new ResultField({
      table_name: this.table_name,
      field_name: alias,
      data_transformers: this.data_transformers,
    }, this.field_name)
  }
}
