import { Database } from '../../sqlite-native/src/mod.ts'
import { Model, schema, query, z } from '../src/mod.ts'

class Author extends Model {

  static schema = schema('author', {
    id:         z.number(),
    first_name: z.string(),
    last_name:  z.string(),
  })
}

class Book extends Model {

  static schema = schema('book', {
    id:         z.number(),
    isbn:       z.string(),
    author_id:  z.number(),
    title:      z.string(),
  })

  // TODO we need to be able to rename fields. Likely this will be: `${Author.schema.id('author_id')}`
  // TODO columns need to include table name, like author.id
  // get = query`SELECT ${[Book.schema.id, Book.schema.isbn]}, ${Book.schema.title} FROM book`
  // get = query`SELECT ${Book.schema.result['*']}  FROM book WHERE id = ${Book.schema.params.id}`
  get = query`SELECT ${Book.schema.result['*']} FROM book WHERE id = ${Book.schema.params.id}`
}


Deno.test('usage', async () => {
  const driver = new Database('test/fixtures/usage.db')
  await driver.connect()

  const book = new Book()
  // const id: number = book.get.params.id
  // const isbn: string = book.get.params.isbn
  // const db = torm(driver, { FooBar })

  // db.models.FooBar.schema

  driver.close()
})
