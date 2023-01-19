import { z } from './deps.ts'

// accepted column values (for sqlite, for now)
type ColumnValue = string | number | bigint | Uint8Array | null;

export interface FieldDefinition<In, Out extends ColumnValue> {
  encode: (val: In) => Out
  decode?: (val: Out) => In

  call_encode: (val: In) => Out
  call_decode: (val: Out) => In
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
    return new OptionalField<In, Out>(this)
  }

  default(val: In) {
    return new DefaultField<In, Out>(this, val)
  }


  public abstract encode: (val: In) => Out
  public abstract decode?: (val: Out) => In

  public call_encode(val: In): Out {
    return this.encode(val)
  }

  public call_decode(val: Out): In {
    if (this.decode) return this.decode(val)
    // we have to cast here because this is technically incorrect. We have checks elsewhere though that would prevent us from writing a field with a missing decoder which has a different output type than input
    else return (val as any) as In
  }
}

class OptionalField<In, Out extends ColumnValue> extends FieldDefinitionBase<In | null, Out | null> {
  public constructor(private field_definition: FieldDefinition<In, Out>) {
    super()
  }

  public encode = (val: In | null): Out | null => {
    if (val === null) return null
    else return this.field_definition.encode(val)
  }

  public decode = (val: Out | null): In | null => {
    if (val === null) return null
    else if (this.field_definition.decode) return this.field_definition.decode(val)
    else return val as In
  }
}

class DefaultField<In, Out extends ColumnValue> extends FieldDefinitionBase<In | null | undefined, Out> {
  public constructor(private field_definition: FieldDefinition<In, Out>, private default_value: In) {
    super()
  }

  public encode = (val: In | null | undefined): Out => {
    if (val === null || val === undefined) return this.encode(this.default_value)
    else return this.field_definition.encode(val)
  }

  public decode = (val: Out | null): In => {
    if (val === null) return this.default_value
    else if (this.field_definition.decode) return this.field_definition.decode(val)
    else return val as In
  }
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
