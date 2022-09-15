import { SQLiteNativeDriver } from '../src/dependencies.ts'
import { schema, z } from '../src/mod.ts'
import { Model } from '../src/drivers/sqlite-native/mod.ts'

// class Author extends Model {

//   static schema = schema('author', {
//     id:         z.number(),
//     first_name: z.string(),
//     last_name:  z.string(),
//   })
// }

class Book extends Model {

  static schema = schema('book', {
    id:         z.number(),
    isbn:       z.string(),
    author_id:  z.number(),
    title:      z.string(),
  })
  static params = Book.schema.params
  static result = Book.schema.result

  // TODO we need to be able to rename fields. Likely this will be: `${Author.schema.id('author_id')}`
  // TODO columns need to include table name, like author.id
  // get = query`SELECT ${[Book.schema.id, Book.schema.isbn]}, ${Book.schema.title} FROM book`
  // get = query`SELECT ${Book.schema.result['*']}  FROM book WHERE id = ${Book.schema.params.id}`
  get = this.query`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`
  // get = this.query`SELECT ${Book.schema.result['*']} FROM book WHERE id = $`
}


Deno.test('usage', async () => {
  const driver = new SQLiteNativeDriver('test/fixtures/usage.db')
  await driver.connect()
  driver.exec(`CREATE TABLE IF NOT EXISTS book (
    id INTEGER NOT NULL PRIMARY KEY,
    isbn STRING NOT NULL,
    author_id INTEGER NOT NULL,
    title TEXT NOT NULL
  );
  INSERT INTO book (isbn, author_id, title) VALUES ('123abc', 1, 'Red Riding Hood');`)

  const book = new Book(driver)
  const row = book.get.one({ id: 1 })
  console.log(row.id)

  driver.close()
})
