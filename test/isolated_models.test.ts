import { test, assert_equals, expect_type } from './util.ts'
import { Model, Torm, SeedMigration, field, MigrationRegistry, schema } from '../drivers/sqlite.ts'


class Author extends Model {
  static schema = schema('author', {
    id:         field.number(),
    first_name: field.string().optional(),
    last_name:  field.string(),
    birthday:   field.datetime().optional(),
  })
  queries = {
    create:
      this.query.exec`INSERT INTO author (first_name, last_name, birthday)
                      VALUES (${[Author.schema.params.first_name, Author.schema.params.last_name, Author.schema.params.birthday]})`,

    get:
      this.query.one `SELECT ${Author.schema.result['*']} FROM author
                      WHERE id = ${Author.schema.params.id}`,
  }
}


class Book extends Model {
  static schema = schema('book', {
    id:         field.number(),
    author_id:  field.number(),
    title:      field.string(),
    data:       field.json(),
    language:   field.string().default('english'),
  })

  queries = {
    create:
      this.query.exec`INSERT INTO book (title, author_id, language, data)
                      VALUES (${[Book.schema.params.title, Book.schema.params.author_id, Book.schema.params.language, Book.schema.params.data]})`,

    get:
      this.query.one `SELECT ${Book.schema.result['*']} FROM book
                      WHERE id = ${Book.schema.params.id}`,

    list_with_author:
      this.query.many`SELECT ${[Book.schema.result.title, Author.schema.result.first_name, Author.schema.result.last_name]} FROM book
                      INNER JOIN author ON author_id = Author.id`,
  }

}


class BookORM extends Torm {
  models = {
    Author: this.model(Author),
    Book: this.model(Book),
  }
}


const migrations = new MigrationRegistry()
@migrations.register()
class AuthorSeedMigration extends SeedMigration {
  version = 1

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
  version = 1

  call = () => this.prepare`
    CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      data TEXT,
      language TEXT NOT NULL,
      FOREIGN KEY(author_id) REFERENCES author(id)
    )
  `.exec()
}




test('query usage with joins across models', async (ctx) => {
  const db = new BookORM(ctx.create_fixture_path('usage.db'), {migrations})
  await db.init()

  const tolkien_insert = db.models.Author.queries.create({ first_name: 'JR', last_name: 'Tolkein' })
  const hobbit_insert = db.models.Book.queries.create({ title: 'The Hobbit', author_id: tolkien_insert.last_insert_row_id, data: {some: 'data'} })

  const book_row = db.models.Book.queries.get({ id: hobbit_insert.last_insert_row_id })
  expect_type<{ id: number; title: string; language: string; author_id: number } | undefined>(book_row)
  assert_equals({
    id: hobbit_insert.last_insert_row_id,
    author_id: tolkien_insert.last_insert_row_id,
    title: 'The Hobbit',
    data: { some: 'data' },
    language: 'english',
  }, book_row)

  const books_and_authors = db.models.Book.queries.list_with_author()
  assert_equals(books_and_authors.length, 1)
  assert_equals(books_and_authors[0]['title'], 'The Hobbit')
  assert_equals(books_and_authors[0]['first_name'], 'JR')
  assert_equals(books_and_authors[0]['last_name'], 'Tolkein')

  const author_row = db.models.Author.queries.get({ id: tolkien_insert.last_insert_row_id })
  expect_type<{ id: number; first_name: string | null; last_name: string } | undefined>(author_row)
  assert_equals('Tolkein', author_row!.last_name)

  db.close()
})
