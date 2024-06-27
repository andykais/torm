import { test, assert_equals, expect_type } from './util.ts'
import { Model, Torm, SeedMigration, field } from '../drivers/sqlite.ts'

class Author extends Model('author', {
  id:         field.number(),
  first_name: field.string().optional(),
  last_name:  field.string(),
  birthday:   field.datetime().optional(),
}) {
  create = this.query`INSERT INTO author (first_name, last_name, birthday) VALUES (${[Author.params.first_name, Author.params.last_name, Author.params.birthday]})`.exec
  get = this.query`SELECT ${Author.result['*']} FROM author WHERE id = ${Author.params.id}`.one
}

class Book extends Model('book', {
  id:         field.number(),
  author_id:  field.number(),
  title:      field.string(),
  data:       field.json(),
  language:   field.string().default('english'),
}) {
  create = this.query`INSERT INTO book (title, author_id, language, data) VALUES (${[Book.params.title, Book.params.author_id, Book.params.language, Book.params.data]})`.exec
  get = this.query`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`.one

  list_with_author = this.query`
    SELECT ${[Book.result.title, Author.result.first_name, Author.result.last_name]} FROM book
    INNER JOIN author ON author_id = Author.id`.all
}

class BookORM extends Torm {
  // models
  author = this.model(Author)
  book   = this.model(Book)
}

@BookORM.migrations.register()
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

@BookORM.migrations.register()
class BookSeedMigration extends SeedMigration {
  version = '1.0.0'

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




test('usage', async (ctx) => {
  const db = new BookORM(ctx.fixture_path('usage.db'))
  await db.init()

  const tolkien_insert = db.author.create({ first_name: 'JR', last_name: 'Tolkein' })
  const hobbit_insert = db.book.create({ title: 'The Hobbit', author_id: tolkien_insert.last_insert_row_id, data: {some: 'data'} })

  const book_row = db.book.get({ id: hobbit_insert.last_insert_row_id })
  expect_type<{ id: number; title: string; language: string; author_id: number } | undefined>(book_row)
  assert_equals({
    id: hobbit_insert.last_insert_row_id,
    author_id: tolkien_insert.last_insert_row_id,
    title: 'The Hobbit',
    data: { some: 'data' },
    language: 'english',
  }, book_row)

  const books_and_authors = db.book.list_with_author()
  assert_equals(books_and_authors.length, 1)
  assert_equals(books_and_authors[0]['title'], 'The Hobbit')
  assert_equals(books_and_authors[0]['first_name'], 'JR')
  assert_equals(books_and_authors[0]['last_name'], 'Tolkein')

  const author_row = db.author.get({ id: tolkien_insert.last_insert_row_id })
  expect_type<{ id: number; first_name: string | null; last_name: string } | undefined>(author_row)
  assert_equals('Tolkein', author_row!.last_name)

  db.close()
})
