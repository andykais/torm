import { test, assert_equals, expect_type } from './util.ts'
import { Model, Torm, Migration, type Driver } from '../src/drivers/sqlite-native/mod.ts'
import * as field from '../src/field.ts'

class Author extends Model('author', {
  id:         field.number(),
  first_name: field.string().optional(),
  last_name:  field.string(),
}) {
  static migrations = {
    initialization: Migration.create('1.0.0', `
      CREATE TABLE IF NOT EXISTS author (
        id INTEGER NOT NULL PRIMARY KEY,
        first_name TEXT,
        last_name TEXT NOT NULL
      )`)
  }

  create = this.query`INSERT INTO author (first_name, last_name) VALUES (${[Author.params.first_name, Author.params.last_name]})`.exec
  get = this.query`SELECT ${Author.result['*']} FROM author WHERE id = ${Author.params.id}`.one
}

class Book extends Model('book', {
  id:         field.number(),
  author_id:  field.number(),
  title:      field.string(),
  data:       field.json(),
  language:   field.string().default('english'),
}) {
  static migrations = {
    initialization: Migration.create('1.0.0', `
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER NOT NULL PRIMARY KEY,
        author_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        data TEXT,
        language TEXT NOT NULL,
        FOREIGN KEY(author_id) REFERENCES author(id)
      )`)
  }

  create = this.query`INSERT INTO book (title, author_id, language, data) VALUES (${[Book.params.title, Book.params.author_id, Book.params.language, Book.params.data]})`.exec
  create_test = this.query`INSERT INTO book (title, author_id, language, data) VALUES (${[Book.params.title, Book.params.author_id, Book.params.language, Book.params.data]})`
  get = this.query`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`.one

  list_with_author = this.query`
    SELECT ${[Book.result.title, Author.result.first_name, Author.result.last_name]} FROM book
    INNER JOIN author ON author_id = Author.id`.all
}

class BookORM extends Torm {
  static migrations = { version: '1.0.0' }

  // models
  author = this.model(Author)
  book   = this.model(Book)
}



test('usage', async () => {
  await Deno.remove('test/fixtures/usage.db').catch(e => { if (e instanceof Deno.errors.NotFound === false) throw e})
  const db = new BookORM('test/fixtures/usage.db')
  await db.init()

  const tolkien_insert = db.author.create({ first_name: 'JR', last_name: 'Tolkein' })
  const hobbit_insert = db.book.create({ title: 'The Hobbit', author_id: tolkien_insert.last_insert_row_id, data: {some: 'data'} })

  const book_row = db.book.get({ id: hobbit_insert.last_insert_row_id })
  // TODO language should be an optional type
  expect_type<{ id: number; title: string; language: string | null | undefined; author_id: number } | undefined>(book_row)
  assert_equals({
    id: hobbit_insert.last_insert_row_id,
    author_id: tolkien_insert.last_insert_row_id,
    title: 'The Hobbit',
    data: { some: 'data' },
    language: 'english',
  }, book_row)

  const books_and_authors = db.book.list_with_author({})
  assert_equals(books_and_authors.length, 1)
  assert_equals(books_and_authors[0]['title'], 'The Hobbit')
  assert_equals(books_and_authors[0]['first_name'], 'JR')
  assert_equals(books_and_authors[0]['last_name'], 'Tolkein')

  const author_row = db.author.get({ id: tolkien_insert.last_insert_row_id })
  expect_type<{ id: number; first_name: string | null; last_name: string } | undefined>(author_row)
  assert_equals('Tolkein', author_row!.last_name)

  db.close()
})
