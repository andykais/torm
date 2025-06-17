import { test, assert_equals, assert_throws } from './util.ts'
import { Model, Torm, SeedMigration, field, errors, MigrationRegistry, schema } from '../drivers/sqlite.ts'


class Author extends Model {
  static schema = schema('author', {
    id:         field.number(),
    first_name: field.string().optional(),
    last_name:  field.string(),
    birthday:   field.datetime().optional(),
  })

  create = this.query`INSERT INTO author (first_name, last_name, birthday) VALUES (${[Author.schema.params.first_name, Author.schema.params.last_name, Author.schema.params.birthday]})`.exec
  get = this.query`SELECT ${Author.schema.result['*']} FROM author WHERE id = ${Author.schema.params.id}`.one
}


class Book extends Model {
  static schema = schema('book', {
    id:         field.number(),
    author_id:  field.number(),
    title:      field.string(),
    data:       field.json(),
    language:   field.string().default('english'),
  })
  create = this.query`INSERT INTO book (title, author_id, language, data) VALUES (${[Book.schema.params.title, Book.schema.params.author_id, Book.schema.params.language, Book.schema.params.data]})`.exec
  get = this.query`SELECT ${Book.schema.result['*']} FROM book WHERE id = ${Book.schema.params.id}`.one

  list_with_author = this.query`
    SELECT ${[Book.schema.result.title, Author.schema.result.first_name, Author.schema.result.last_name]} FROM book
    INNER JOIN author ON author_id = Author.id`.all
}


class BookORM extends Torm {
  // models
  author = this.model(Author)
  book   = this.model(Book)
}


const migrations = new MigrationRegistry()
@migrations.register()
class AuthorSeedMigration extends SeedMigration {
  version = '1.0.0'

  call = () => this.prepare`
    CREATE TABLE IF NOT EXISTS author (
      id INTEGER NOT NULL PRIMARY KEY,
      first_name TEXT,
      last_name TEXT NOT NULL,
      birthday TEXT
    )
  `.exec()
}


@migrations.register()
class BookSeedMigration extends SeedMigration {
  version = '1.0.0'

  call = () => this.driver.exec(`
    CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      data TEXT,
      language TEXT NOT NULL,
      FOREIGN KEY(author_id) REFERENCES author(id)
    );
    CREATE UNIQUE INDEX author_title ON book(author_id, title);
  `)
}




// skipping this test for now until deno's node:sqlite implements unique constraint errors https://github.com/denoland/deno/issues/28289
test('exceptions', async (ctx) => {
  const db = new BookORM(ctx.create_fixture_path('usage.db'), {migrations})
  await db.init()

  const tolkien_insert = db.author.create({ first_name: 'JR', last_name: 'Tolkein' })
  const hobbit_insert = db.book.create({ title: 'The Hobbit', author_id: tolkien_insert.last_insert_row_id, data: {some: 'data'} })

  // inserting the exception again will throw a UniqueConstraintError with metadata about what failed
  const exception = assert_throws(() => {
    db.book.create({ title: 'The Hobbit', author_id: tolkien_insert.last_insert_row_id, data: {some: 'data'} })
  }, errors.UniqueConstraintError)
  assert_equals({title: 'The Hobbit', author_id: 1, data: {some: 'data'} }, exception.params)

  db.close()
})
