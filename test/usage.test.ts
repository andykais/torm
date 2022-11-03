import { test, assert_equals, expect_type } from './util.ts'

import { schema, z } from '../src/mod.ts'
import { Model, Torm, Migration, type Driver } from '../src/drivers/sqlite-native/mod.ts'
import * as field from '../src/field.ts'

class Author extends Model('author', {
  id:         field.number(),
  first_name: field.string(),
  last_name:  field.string(),
}) {
  static migrations = {
    initialization: Migration.create('1.1.0', `
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
}) {
  static migrations = {
    initialization: Migration.create('1.1.0', `
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER NOT NULL PRIMARY KEY,
        author_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        data TEXT,
        FOREIGN KEY(author_id) REFERENCES author(id)
      )`)
  }

  create = this.query`INSERT INTO book (title, author_id, data) VALUES (${[Book.params.title, Book.params.author_id, Book.params.data]})`.exec
  get = this.query`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`.one

  list_with_author = this.query`
    SELECT ${[Book.result.title, Author.result.first_name, Author.result.last_name]} FROM book
    INNER JOIN author ON author_id = Author.id`.all
}

// const add_published_at_field_migration = migration('1.1.0', (driver: Driver) => {
//   driver.exec(`ALTER TABLE book ADD COLUMN published_at DATETIME`)
// })

class AddPublishedAtFieldMigration extends Migration {
  version = '1.1.0' as const

  call() {
    this.driver.exec(`ALTER TABLE book ADD COLUMN published_at DATETIME`)
  }
}


class BookORM extends Torm {
  static migrations = {
    version: '1.1.0',
    // initialization: InitializeSchemasMigration,
    // upgrades: [AddPublishedAtFieldMigration],
  }

  // models
  author = this.model(Author)
  book   = this.model(Book)
}

// const torm = new Torm({ logger, auto_migrate: false })
// const migrator = Torm.migrate(torm)
// while (migrator.has_next()) {
//   console.log(`Migrating from ${torm.schemas.version()} to ${migrator.next_version()}`)
//   migrator.next()
// }
// console.log(`Final table schema: ${torm.schemas.tables()}`)



test('usage', async () => {
  await Deno.remove('test/fixtures/usage.db').catch(e => { if (e instanceof Deno.errors.NotFound === false) throw e})
  const db = new BookORM('test/fixtures/usage.db')
  await db.init()

  const info = db.author.create({ first_name: 'JR', last_name: 'Tolkein' })
  db.book.create({ title: 'The Hobbit', author_id: (info as any).last_insert_row_id, data: {some: 'data'} })

  const book_row = db.book.get({ id: 1 })
  expect_type<{ id: number; title: string; author_id: number }>(book_row)
  assert_equals(book_row.title, 'The Hobbit')
  assert_equals(book_row.data, {some: 'data'})

  const books_and_authors = db.book.list_with_author({})
  assert_equals(books_and_authors.length, 1)
  assert_equals(books_and_authors[0]['title'], 'The Hobbit')
  assert_equals(books_and_authors[0]['first_name'], 'JR')
  assert_equals(books_and_authors[0]['last_name'], 'Tolkein')

  db.close()
})

test('migrations', async () => {
    await Deno.remove('test/fixtures/migrations.db').catch(e => { if (e instanceof Deno.errors.NotFound === false) throw e})
    const db = new BookORM('test/fixtures/migrations.db')
    await db.init()

    assert_equals('1.1.0', db.schemas.version())
    db.close()

    class Book_V2 extends Model('book', {
      id:           field.number(),
      author_id:    field.number(),
      title:        field.string(),
      data:         field.json(),
      published_at: field.datetime(),
    }) {
      get = this.query`SELECT ${Book_V2.result['*']} FROM book WHERE id = ${Book_V2.params.id}`.one
    }
    class BookORM_V2 extends Torm {
      static migrations = {
        version: '1.1.1',
        upgrades: [Migration.create('1.1.1', 'ALTER TABLE book ADD COLUMN published_at DATETIME')]
      }
      book = this.model(Book_V2)
    }

    const db_v2 = new BookORM_V2('test/fixtures/migrations.db')
    await db_v2.init()
    assert_equals('1.1.1', db_v2.schemas.version())
    db_v2.close()
  })
