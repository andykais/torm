import { test, assert_equals, expect_type } from './util.ts'
import { Model, Vars, Torm, SeedMigration, field, MigrationRegistry, schema } from '../drivers/sqlite.ts'


const vars = Vars({
  limit: field.number(),
  total: field.number(),
})


class Book extends Model {
  static schema = schema('book', {
    id:    field.number(),
    title: field.string(),
  })

  create = this.query`INSERT INTO book (title) VALUES (${Book.schema.params.title})`.exec
  // other potential designs...
  // create = this.query`SELECT ${Book.params['*']} FROM book LIMIT ${params('limit').number()}`.exec
  // create = this.query`SELECT ${Book.params['*']} FROM book LIMIT ${params.limit.number()}`.exec

  list = this.query`SELECT ${Book.schema.result['*']} FROM book ORDER BY id LIMIT ${vars.params.limit}`.all
  count = this.query`SELECT COUNT(*) as ${vars.result.total} FROM book`.one
}

class BookORM extends Torm {
  book = this.model(Book)
}

const migrations = new MigrationRegistry()
@migrations.register()
class BookMigration extends SeedMigration {
  version = '1.0.0'
  call = () => this.prepare`
    CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      title TEXT NOT NULL
    )
  `.exec()
}

test('fields without models', async (ctx) => {
  const db = new BookORM(ctx.create_fixture_path('test.db'), {migrations})
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

  const count = db.book.count()!
  expect_type<{ total: number }>(count)
  assert_equals(count, { total: 3 })

  db.close()
})

