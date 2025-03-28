# TORM
[![JSR](https://jsr.io/badges/@torm/sqlite)](https://jsr.io/@torm/sqlite)
[![Checks](https://github.com/andykais/torm/actions/workflows/ci.yml/badge.svg)](https://github.com/andykais/torm/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/andykais/torm)](https://github.com/andykais/torm/blob/master/LICENSE)

A typesafe database ORM that exposes the full power of handwritten sql statements to the developer.


## Getting Started
```ts
import { Torm, Model, schema, field } from 'jsr:@torm/sqlite'


class Book extends Model {
  static schema = schema('book', {
    id:           field.number(),
    title:        field.string(),
    language:     field.string().default('english'),
    published_at: field.datetime().optional(),
  })

  create = this.query.exec`INSERT INTO book (title, language, published_at) VALUES (${[Book.schema.params.title, Book.params.language, Book.params.published_at]})`
  get = this.query.one`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.schema.params.id}`
  list = this.query.many`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.schema.params.id}`
}


class BookORM extends Torm {
  book = this.model(Book)
}

const db = new BookORM('books.db')
await db.init()
const info = db.book.create({ title: 'The Hobbit', published_at: new Date('September 21, 1937') })
const row = db.book.get({ id: info.last_insert_row_id })

console.log(row?.title, 'written in', row?.language, 'published on', row?.published_at)
// "The Hobbit written in english published on 1937-09-21T04:00:00.000Z"
```


## Migrations
Torm includes a full migration system, which can be declared like so:
```ts
import { Torm, Model, Migration, SeedMigration, field } from 'jsr:@torm/sqlite'

class Author extends Model {
  static schema = schema('author', {
    id:           field.number(),
    name:         field.string(),
  })

  create = this.query.exec`INSERT INTO author (name) VALUES (${Author.schema.params.name})`
}

class Book extends Model {
  static schema = schema('book', {
    id:           field.number(),
    title:        field.string(),
    language:     field.string().default('english'),
    published_at: field.datetime().optional(),
    author_id:    field.number().optional(),
  })

  create = this.query.exec`INSERT INTO book (title, language, published_at, author_id) VALUES (${[Book.schema.params.title, Book.schema.params.language, Book.schema.params.published_at, Book.schema.params.author_id]})`
  get = this.query.one`SELECT ${Book.schema.result['*']} FROM book WHERE id = ${Book.schema.params.id}`
  set_author = this.query.exec`UPDATE book SET author_id = ${Book.schema.params.author_id} WHERE title = ${Book.schema.params.title}`
}

class BookORM extends Torm {
  book = this.model(Book)
  author = this.model(Author)
}

const migrations = new MigrationRegistry()
@migrations.register()
class InitializationMigration extends SeedMigration {
  version = '1.1.0'
  
  call() {
    this.driver.exec(`
      CREATE TABLE author (
        id INTEGER NOT NULL PRIMARY KEY,
        name TEXT NOT NULL
      );
  
      CREATE TABLE book (
        id INTEGER NOT NULL PRIMARY KEY,
        title TEXT NOT NULL,
        data TEXT,
        language TEXT NOT NULL,
        published_at TEXT,
        author_id INTEGER,
        FOREIGN KEY(author_id) REFERENCES author(id)
      )`
    )
  }
}
// later on, we may add a author table
@migrations.register()
class AddAuthorIdColumnMigration extends Migration {
    version = '1.1.0'
    call() {
        this.db.exec('ALTER TABLE book ADD COLUMN author_id TEXT REFERENCES author_id(id)')
    }
}

const db = new BookORM('books.db', {migrations})
await db.init()
const info = db.author.create({ name: 'JR Tolkien' })
db.book.set_author({ title: 'The Hobbit', author_id: info.last_insert_row_id })
```

## Builtin Schema Model
A torm db instance comes with a built in model called `schemas`. It contains useful metadata about your database, and can even aid you in testing.
```ts
// As an example of how this can be used, this is a test where we can create a fresh database,
// and migrate an older database then we can compare that the two databases have identical table structures.
// This is a very useful sanity check when writing migrations
test('migration structure', async () => {
  const db_new = new BookORM('test/fixtures/migrations.db')
  await db_new.init()
  assert_equals('1.1.0', db_new.schemas.version())
  const tables_new = db_new.schemas.tables()

  const db_old = new BookORM('test/fixtures/migrations_1.0.0.db')
  await db_old.init()
  assert_equals('1.1.0', db_old.schemas.version())
  const tables_old = db_old.schemas.tables()
  assert_equals(tables_new, tables_old)
})

```

## Philosophy
This library does not intend to be a set-it-and-forget-it ORM. Production ready applications need developers to understand exactly what queries are being ran against the database. Often this information is shrouded in traditional ORMs and developers end up treating the database like a black box. Torm instead forces developers to write their own queries, but keeps some of the advantages of traditional ORMs by keeping type-safety a first class citizen.

When a team gets to be larger than a single developer working on the backend, queries often need to be reviewed and approved, and this library takes the position that declarative queries are better served than inline queries sprinkled throughout your application.

Besides the benefit of better visibility into queries, this means that Torm can prepare all your queries for free at the time of database connection. This avoids any of the difficulty that systems like Prisma, or Sequelize have around LRU caching of prepared queries (which at the very least are always slow on the first call).

> The first gulp from the glass of **backend development** will turn you to **ORMs**, but at the bottom of the glass **raw sql queries** are waiting for you
