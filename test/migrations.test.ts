import { test, assert_equals } from './util.ts'
import { Model, Torm, Migration, SeedMigration, MigrationRegistry, field, schema } from '../drivers/sqlite.ts'


class Author extends Model {
  static schema = schema('author', {
    id:         field.number(),
    first_name: field.string().optional(),
    last_name:  field.string(),
  })

  create = this.query`INSERT INTO author (first_name, last_name) VALUES (${[Author.schema.params.first_name, Author.schema.params.last_name]})`.exec
  get = this.query`SELECT ${Author.schema.result['*']} FROM author WHERE id = ${Author.schema.params.id}`.one
}

class Book extends Model {
  static schema = schema('book', {
    id:           field.number(),
    author_id:    field.number(),
    title:        field.string(),
    data:         field.json().optional(),
    published_at: field.datetime().optional(),
  })

  create = this.query`INSERT INTO book (title, author_id, data, published_at) VALUES (${[Book.schema.params.title, Book.schema.params.author_id, Book.schema.params.data, Book.schema.params.published_at]})`.exec
  get = this.query`SELECT ${Book.schema.result['*']} FROM book WHERE id = ${Book.schema.params.id}`.one
  find = this.query`SELECT ${Book.schema.result['*']} FROM book`.all
  get_with_author = this.query`SELECT ${[
    Book.schema.result.title,
    Book.schema.result.published_at,
    Book.schema.result.data,
    Author.schema.result.last_name,
    Author.schema.result.first_name,
  ]} FROM book
    INNER JOIN author ON author.id = author_id
    WHERE title = ${Book.schema.params.title}`.one
}

class BookORM extends Torm {
  book = this.model(Book)
  author = this.model(Author)
}

const migrations = new MigrationRegistry()

@migrations.register()
class InitMigration extends SeedMigration {

  version = '1.2.0'

  call = () => this.driver.exec(`
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
  `)
}

@migrations.register()
class PublishedAtMigration extends Migration {
  version = '1.2.0'

  call = () => this.driver.exec(`ALTER TABLE book ADD COLUMN published_at DATETIME`)
}

// new alternate thought
/*
@BookORM.migrations.new()
class InitMigration extends Migration {
  upgrade = this.query`
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
  `
}

BookORM.migrations.register()
class PublishedAtMigration extends Migration {
  upgrade = this.query`ALTER TABLE book ADD COLUMN published_at DATETIME`
  downgrade = () => { throw new Error('unimplemented') }
}
*/




// Alternate thought:
/*
class BookORM extends Torm {
  book = this.model(Book)
  author = this.model(Author)
}
BookORM.migrations.initialization = Migration.create('1.2.0', `
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
`)
BookORM.migrations.upgrades.push(Migration.create('1.2.0', 'ALTER TABLE book ADD COLUMN published_at DATETIME'))

BookORM.migrations.initialization = Migration.create('1.2.0', `
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
`)
BookORM.migrations.upgrades.push(Migration.create('1.2.0', 'ALTER TABLE book ADD COLUMN published_at DATETIME'))
*/


test('auto migration', async (ctx) => {
  const db_new: BookORM | undefined = new BookORM(ctx.create_fixture_path('migrations.db'), {migrations})
  await db_new.init()
  assert_equals('1.2.0', db_new.schemas.version())
  const tables_new = db_new.schemas.tables()

  const db_old = new BookORM(ctx.create_fixture_path('migrations_1.0.0.db'), {migrations})
  await db_old.init()
  assert_equals('1.2.0', db_old.schemas.version())
  const tables_old = db_old.schemas.tables()

  assert_equals(tables_new, tables_old)

  db_new.close()
  db_old.close()

  // check that we dont run migrations twice
  const db_new2 = new BookORM(ctx.create_fixture_path('migrations.db'), {migrations})
  await db_new2.init()
  assert_equals('1.2.0', db_new2.schemas.version())
  assert_equals(tables_new, db_new2.schemas.tables())
  db_new2.close()
})

test('manual migration', async (ctx) => {
  const db_old_path = ctx.create_fixture_path('migrations_1.0.0.db')
  await Deno.copyFile(ctx.resources.books_db_1_0_0, db_old_path)

  const db_new = new BookORM('test/fixtures/migrations.db', {migrations})
  await db_new.init()
  assert_equals('1.2.0', db_new.schemas.version())
  const tables_new = db_new.schemas.tables()

  const db_old = new BookORM(db_old_path, {migrations})
  await db_old.init({ auto_migrate: false })
  assert_equals('1.0.0', db_old.schemas.version())
  assert_equals(true, db_old.migrations.is_database_outdated())
  db_old.migrations.upgrade_database()
  assert_equals('1.2.0', db_old.schemas.version())
  assert_equals(false, db_old.migrations.is_database_outdated())
  db_old.init({ auto_migrate: false }) // a second call will initialize models. TODO maybe add an "init_only: true" flag

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
