import { assertEquals as assert_equals } from "https://deno.land/std@0.155.0/testing/asserts.ts";
import { expectType } from "https://cdn.skypack.dev/ts-expect?dts"

import { SQLiteNativeDriver } from '../src/dependencies.ts'
import { schema, z, torm } from '../src/mod.ts'
import { Model } from '../src/drivers/sqlite-native/mod.ts'

class Author extends Model('author', {
  id:         z.number(),
  first_name: z.string(),
  last_name:  z.string(),
}) {
  create = this.query`INSERT INTO author (first_name, last_name) VALUES (${[Author.params.first_name, Author.params.last_name]})`.exec
  get = this.query`SELECT ${Author.result['*']} FROM author WHERE id = ${Author.params.id}`.one
}

class Book extends Model('book', {
  id:         z.number(),
  author_id:  z.number(),
  title:      z.string(),
}) {

  create = this.query`INSERT INTO book (title, author_id) VALUES (${[Book.params.title, Book.params.author_id]})`.exec
  get = this.query`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`.one

  list_with_author = this.query`
    SELECT ${[Book.result.title, Author.result.first_name, Author.result.last_name]} FROM book
    INNER JOIN author ON author_id = Author.id`.all
}


// class BookORM extends Torm {

//   author = this.model(Author)
//   book   = this.model(Book)


//   migrations = []
// }


Deno.test('usage', async () => {
  await Deno.remove('test/fixtures/usage.db').catch(e => { if (e instanceof Deno.errors.NotFound === false) throw e})
  const driver = new SQLiteNativeDriver('test/fixtures/usage.db')
  await driver.connect()
  driver.exec(`
  CREATE TABLE IF NOT EXISTS author (
    id INTEGER NOT NULL PRIMARY KEY,
    first_name TEXT,
    last_name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS book (
    id INTEGER NOT NULL PRIMARY KEY,
    author_id INTEGER NOT NULL, -- TODO fireign key
    title TEXT NOT NULL,
    FOREIGN KEY(author_id) REFERENCES author(id)
  );
  `)

  const db = await torm(driver, {
    book: Book,
    author: Author
  })

  const info = db.author.create({ first_name: 'JR', last_name: 'Tolkein' })
  db.book.create({ title: 'The Hobbit', author_id: (info as any).last_insert_row_id })

  const book_row = db.book.get({ id: 1 })
  expectType<{ id: number; title: string; author_id: number }>(book_row)
  assert_equals(book_row.title, 'The Hobbit')

  const books_and_authors = db.book.list_with_author({})
  assert_equals(books_and_authors.length, 1)
  assert_equals(books_and_authors[0]['title'], 'The Hobbit')
  assert_equals(books_and_authors[0]['first_name'], 'JR')
  assert_equals(books_and_authors[0]['last_name'], 'Tolkein')

  driver.close()
})
