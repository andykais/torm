import type { Driver as SQLiteNativeDriver } from './drivers/sqlite.ts'

type AllKeys<T> = T extends any ? keyof T : never;
type PickType<T, K extends AllKeys<T>> = T extends { [k in K]?: any }
    ? T[K]
    : never;

// deno-lint-ignore ban-types
export type Merge<T extends object> = {
  [k in AllKeys<T>]: PickType<T, k>;
}
export type ValueOf<T> = T[keyof T]

// deno-lint-ignore ban-types
export type Constructor<T = {}> = new (...args: any[]) => T;

export type Driver =
  | SQLiteNativeDriver


type TNullProperties<T> = {
  [K in keyof T as null extends T[K] ? K : never]?: T[K];
}
type TNotNullProperties<T> = {
  [K in keyof T as null extends T[K] ? never : K]: T[K];
}
export type OptionalKeys<T> = TNullProperties<T> & TNotNullProperties<T>

// export type OptionalOnEmpty<T> = keyof T extends never ? ([T] | []) : [T]
export type OptionalOnEmpty<T> = [keyof T] extends [never] ? [T] | [] : [T];

export type KeyOf<T> = Extract<keyof T, string>

