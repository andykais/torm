import * as z from 'https://deno.land/x/zod@v3.18.0/mod.ts'
import type { SQLiteNativeDriver } from './dependencies.ts'

type AllKeys<T> = T extends any ? keyof T : never;
type PickType<T, K extends AllKeys<T>> = T extends { [k in K]?: any }
    ? T[K]
    : never;
export type Merge<T extends object> = {
  [k in AllKeys<T>]: PickType<T, k>;
}
export type ValueOf<T> = T[keyof T]

export type ZodInput<T extends z.ZodSchema<any, any, any>> = T extends z.ZodSchema<infer In, any, any>
    ? In
    : never

export type Constructor<T = {}> = new (...args: any[]) => T;

export type Driver =
  | SQLiteNativeDriver
