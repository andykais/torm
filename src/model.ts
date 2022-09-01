import * as z from 'https://deno.land/x/zod@v3.18.0/mod.ts'

interface Field<In, Out> {
  name: string
  encode: (v: In) => Out
  decode: (v: Out) => In
}

function field<In, Out, Def>(type: z.ZodSchema<In, Def, Out>, name?: string):  Field<In, Out> {
  return {
    name: 'hello',
    encode: (v: any) => ({} as any),
    decode: (v: any) => ({} as any),
  }
}

type SchemaGeneric = {
  [field: string]: Field<any, any>
}

abstract class Model<S, Q> {

}

export { Model }
