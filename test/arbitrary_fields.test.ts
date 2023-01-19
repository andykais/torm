import { test, assert_equals, expect_type } from './util.ts'
import { Model, Torm, Migration, field } from '../drivers/sqlite.ts'


class Util extends Model('builtin', {
  limit: field.number()
}) {}

class Book extends Model('book', {
  id:    field.number(),
  title: field.string(),
}) {
  static migrations = {
    initialization: Migration.create('1.0.0', `
      CREATE TABLE book (
        id INTEGER NOT NULL PRIMARY KEY,
        title TEXT NOT NULL
      )`)
  }
  // create = this.query`SELECT ${Book.params['*']} FROM book LIMIT ${params('limit').number()}`.exec
  // create = this.query`SELECT ${Book.params['*']} FROM book LIMIT ${params.limit.number()}`.exec
  create = this.query`INSERT INTO book (title) VALUES (${Book.params.title})`.exec
  list = this.query`SELECT ${Book.result['*']} FROM book ORDER BY id LIMIT ${Util.params.limit}`.all
}

class BookORM extends Torm {
  book = this.model(Book)
}

test('fields without models', async (ctx) => {
  const db = new BookORM(ctx.fixture_path('test.db'))
  await db.init()

  db.book.create({ title: 'The Hobbit' })
  db.book.create({ title: 'The Giver' })
  db.book.create({ title: 'Mistborn' })

  const books = db.book.list({ limit: 2 })
  expect_type<{ title: string }[]>(books)
  assert_equals(books, [
    { id: 1, title: 'The Hobbit' },
    { id: 2, title: 'The Giver' },
  ])

  db.close()
})

