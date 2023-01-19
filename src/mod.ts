// type SchemaGeneric = {
//     [field: string]: ZodSchema<any, any>
// }
// type BuildSchemaFieldGeneric = {
//     encode: ZodSchema<any, any>
//     decode: ZodSchema<any, any>
//     field_name: string
// }
// type BuildSchemaGeneric = {
//     [field: string]: BuildSchemaFieldGeneric
// }
// type BuildSchemaField<Name extends string, Encode extends ZodSchema<any, any>, Decode extends ZodSchema<any, any>> = {
//     encode: Encode
//     decode: Decode
//     field_name: Name
// }
// type BuildSchema<T extends SchemaGeneric> = {
//     [K in keyof T]: {
//         encode: T[K]
//         decode: T[K]
//         field_name: K
//     }
// }


// function schema<T extends SchemaGeneric>(schema: T) {
//     const built_schema: Partial<BuildSchema<T>> = {}
//     Object.keys(schema).forEach((field: keyof T) => {
//         built_schema[field] = {
//             encode: schema[field],
//             decode: schema[field],
//             field_name: field
//         }
//     })
//     return built_schema as BuildSchema<T>
// }

// type AllKeys<T> = T extends any ? keyof T : never;
// type PickType<T, K extends AllKeys<T>> = T extends { [k in K]?: any }
//     ? T[K]
//     : never;
// type Merge<T extends object> = {
//   [k in AllKeys<T>]: PickType<T, k>;
// }

// type StatementParams<T extends BuildSchemaFieldGeneric[]> =
//     Merge<T extends Array<infer B>
//         ? B extends BuildSchemaField<infer Name, any, any>
//             ? { [K in Name]: ZodInput<B['encode']> }
//             : never
//         : never>


// function query<T extends BuildSchemaFieldGeneric[]>(strings: TemplateStringsArray, ...params: T): Statement<StatementParams<T>, {}> {
//     return {
//         one:  (params: {}) => ({}),
//         all:  (params: {}) => [],
//         exec: (params: {}) => {},
//         params: {} as StatementParams<T>
//     }
// }

// interface Statement<Params extends {}, Result> {
//     one: (params: Params) => Result
//     all: (params: Params) => Result[]
//     exec: (params: Params) => void
//     params: Params
// }

// type ZodSchema<In, Out> = (param: In) => Out
// const z = {
//     string: () => ({}) as ZodSchema<string, string>,
//     number: () => ({}) as ZodSchema<number, number>,
// }
// type ZodInput<T extends ZodSchema<any, any>> = T extends ZodSchema<infer In, any>
//     ? In
//     : never

// // usage
// class Book {
//     static schema = schema({
//         isbn: z.string(),
//         author_id: z.number()
//     })


//     get = query`SELECT ${Book.schema.author_id} FROM book WHERE isbn = ${Book.schema.isbn}`

//     // constructor(driver: SQLite) {
//     //     this.get = driver.prepare<{ isbn: string }, { author_id: string }>(`SELECT author_id FROM book WHERE isbn = :isbn`)
//     //     this.get.one({isbn: 'sdfb'})
//     // }

//     // select_book_and_author = query`SELECT ${[Book.params.author_id, Author.params.name]} FROM book INNER JOIN ...`
// }

// const book = new Book()

// book.select_one.one({ author_id: 1 }) // missing isbn param
// book.select_one.one({ author_id: 1, isbn: -1 }) // isbn should be a string
// book.select_one.one({ author_id: 1, isbn: 'abcd-1234' }) // isbn should be a string
export { Model } from './model.ts'
export { schema } from './schema.ts'
export { query } from './query.ts'
export * as z from 'https://deno.land/x/zod@v3.18.0/mod.ts'
