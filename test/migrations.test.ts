import { test, assert_equals } from './util.ts'
import { Model, Torm, Migration, field } from '../drivers/sqlite.ts'


class Author extends Model('author', {
  id:         field.number(),
  first_name: field.string().optional(),
  last_name:  field.string(),
}) {
  create = this.query`INSERT INTO author (first_name, last_name) VALUES (${[Author.params.first_name, Author.params.last_name]})`.exec
  get = this.query`SELECT ${Author.result['*']} FROM author WHERE id = ${Author.params.id}`.one
}

class Book extends Model('book', {
  id:           field.number(),
  author_id:    field.number(),
  title:        field.string(),
  data:         field.json().optional(),
  published_at: field.datetime().optional(),
}) {
  create = this.query`INSERT INTO book (title, author_id, data, published_at) VALUES (${[Book.params.title, Book.params.author_id, Book.params.data, Book.params.published_at]})`.exec
  get = this.query`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`.one
  find = this.query`SELECT ${Book.result['*']} FROM book`.all
  get_with_author = this.query`SELECT ${[
    Book.result.title,
    Book.result.published_at,
    Book.result.data,
    Author.result.last_name,
    Author.result.first_name,
  ]} FROM book
    INNER JOIN author ON author.id = author_id
    WHERE title = ${Book.params.title}`.one
}
class BookORM extends Torm {
  static migrations = {
    version: '1.2.0',
    initialization: Migration.create('1.2.0', `
      CREATE TABLE IF NOT EXISTS author (
        id INTEGER NOT NULL PRIMARY KEY,
        first_name TEXT,
        last_name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER NOT NULL PRIMARY KEY,
        author_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        data TEXT,
        published_at DATETIME,
        FOREIGN KEY(author_id) REFERENCES author(id)
      );
    `),
    upgrades: [
      Migration.create('1.2.0', 'ALTER TABLE book ADD COLUMN published_at DATETIME'),
    ]
  }

  book = this.model(Book)
  author = this.model(Author)
}


test('auto migration', async () => {
  await Deno.remove('test/fixtures/migrations.db').catch(e => { if (e instanceof Deno.errors.NotFound === false) throw e})
  await Deno.copyFile('test/resources/migrations_1.0.0.db', 'test/fixtures/migrations_1.0.0.db')
  let db_new = new BookORM('test/fixtures/migrations.db')
  await db_new.init()
  assert_equals('1.2.0', db_new.schemas.version())
  const tables_new = db_new.schemas.tables()

  const db_old = new BookORM('test/fixtures/migrations_1.0.0.db')
  await db_old.init()
  assert_equals('1.2.0', db_old.schemas.version())
  const tables_old = db_old.schemas.tables()

  assert_equals(tables_new, tables_old)

  db_new.close()
  db_old.close()

  // check that we dont run migrations twice
  db_new = new BookORM('test/fixtures/migrations.db')
  await db_new.init()
  assert_equals('1.2.0', db_new.schemas.version())
  assert_equals(tables_new, db_new.schemas.tables())
  db_new.close()
})

test('manual migration', async () => {
  await Deno.remove('test/fixtures/migrations.db').catch(e => { if (e instanceof Deno.errors.NotFound === false) throw e})
  await Deno.copyFile('test/resources/migrations_1.0.0.db', 'test/fixtures/migrations_1.0.0.db')
  const db_new = new BookORM('test/fixtures/migrations.db')
  await db_new.init()
  assert_equals('1.2.0', db_new.schemas.version())
  const tables_new = db_new.schemas.tables()

  const db_old = new BookORM('test/fixtures/migrations_1.0.0.db')
  await db_old.init({ auto_migrate: false })
  assert_equals('1.0.0', db_old.schemas.version())
  assert_equals(true, Migration.outdated(db_old))
  Migration.upgrade(db_old) // migrating to the most recent version will also initialize models
  assert_equals('1.2.0', db_old.schemas.version())
  assert_equals(false, Migration.outdated(db_old))

  assert_equals([{
    id: 1,
    author_id: 1,
    title: "The Hobbit",
    data: { some: "data" },
    published_at: null
  }], db_old.book.find({}))

  db_old.book.create({
    title: 'Going Postal',
    author_id: db_old.author.create({
      first_name: 'Terry',
      last_name: 'Pratchett'
    }).last_insert_row_id,
    data: { description: 'A first class adventure starring Moist Von Lipwig, Adora Belle Dearheart and The Ankh-Morpork Post Office in a race against the Clacks!' },
    published_at: new Date('9/25/2004')
  })
  assert_equals({
    title: "Going Postal",
    data: { description: 'A first class adventure starring Moist Von Lipwig, Adora Belle Dearheart and The Ankh-Morpork Post Office in a race against the Clacks!' },
    published_at: new Date('9/25/2004'),
    first_name: 'Terry',
    last_name: 'Pratchett',
  }, db_old.book.get_with_author({ title: 'Going Postal' }))

  const tables_old = db_old.schemas.tables()
  assert_equals(db_new.schemas.version(), db_old.schemas.version())
  assert_equals(tables_new, tables_old)

  db_new.close()
  db_old.close()
})
