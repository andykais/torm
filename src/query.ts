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

  alias_of: string | undefined

  public constructor(schema_field: T, alias_of?: string) {
    super(schema_field)
    this.alias_of = alias_of
  }

  public as<A extends string>(alias: A): AliasResultField<T, A> {
    return new ResultField({
      table_name: this.table_name,
      field_name: alias,
      data_transformers: this.data_transformers,
    }, this.field_name)
  }
}
