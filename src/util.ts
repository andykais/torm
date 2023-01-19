import * as z from 'https://deno.land/x/zod@v3.18.0/mod.ts'

declare const __nominal__type: unique symbol;
export type Nominal<Type, Identifier> = Type & {
  readonly [__nominal__type]: Identifier;
};
export type NominalMapUnion<T, Identifier> = T extends any ? Nominal<T, Identifier> : never;
export type NominalMapObject<T, Identifier> = {
  [K in keyof T]: Nominal<T[K], Identifier>
}

export type ValueOf<T> = T[keyof T]

export type ZodInput<T extends z.ZodSchema<any, any, any>> = T extends z.ZodSchema<infer In, any, any>
    ? In
    : never


export { z }
