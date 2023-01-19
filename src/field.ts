import { z } from './dependencies.ts'

// accepted column values (for sqlite, for now)
type ColumnValue = string | number | bigint | Uint8Array | null;

export interface FieldDefinition<In, Out extends ColumnValue> {
  encode: (val: In) => Out
  decode?: (val: Out) => In

  is_optional: boolean
}

export type FieldInput<F extends FieldDefinition<any, any>> =
  F extends FieldDefinition<infer In, any>
    ? In
    : never

export type FieldOutput<F extends FieldDefinition<any, any>> =
  F extends FieldDefinition<any, infer Out>
    ? Out
    : never

abstract class FieldDefinitionBase<In, Out extends ColumnValue> implements FieldDefinition<In, Out> {
  optional() {
    this.is_optional = true
    return this
  }

  is_optional = false

  public abstract encode: (val: In) => Out
  public abstract decode?: (val: Out) => In
}

class IdentityFieldDefinition<T extends ColumnValue> extends FieldDefinitionBase<T, T> {
  encode = (val: T) => val
  decode = (val: T) => val
}

class StringFieldDefinition extends IdentityFieldDefinition<string> {}
class NumberFieldDefinition extends IdentityFieldDefinition<number> {}
class BooleanFieldDefinition extends FieldDefinitionBase<boolean, number> {
  encode = z.boolean().transform(val => val ? 1 : 0).parse
  decode = z.number().transform(val => Boolean(val)).parse
}

const z_literal = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof z_literal>;
type Json = Literal | { [key: string]: Json } | Json[];
const z_json: z.ZodType<Json> = z.lazy(() =>
  z.union([z_literal, z.array(z_json), z.record(z_json)])
)
class JsonFieldDefinition<T extends Json> extends FieldDefinitionBase<T, string> {
  encode = z_json.transform(val => JSON.stringify(val)).parse
  decode = z.string().transform(val => JSON.parse(val)).parse
}

class DateTimeFieldDefinition extends FieldDefinitionBase<Date, string> {
  encode = z.date().transform(val => val.toString()).parse
  decode = z.string().transform(val => new Date(val)).parse
}

// field definitions
export const string   = () => new StringFieldDefinition()
export const number   = () => new NumberFieldDefinition()
export const boolean  = () => new BooleanFieldDefinition()
export const datetime = () => new DateTimeFieldDefinition()
export const json     = () => new JsonFieldDefinition()
