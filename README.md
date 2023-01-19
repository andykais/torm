# TORM
A typesafe database ORM that exposes the full power of handwritten sql statements to the developer.



## Getting Started
```ts
import { Torm, Model, field } from 'https://deno.land/x/torm/src/drivers/sqlite.ts'


class Book extends Model('book', {
  id:           field.number(),
  title:        field.string(),
  language:     field.string().default('english'),
  published_at: field.datetime().optional(),
}) {
  create = this.query`INSERT INTO book (title, language, published_at) VALUES (${[Book.params.title, Book.params.language, Book.params.published_at]})`.exec
  get = this.query`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`.one
}


class BookORM extends Torm {
  static migrations = { version: '1.0.0' }
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
import { Torm, Model, Migration, field } from 'https://deno.land/x/torm/src/drivers/sqlite.ts'

class Author extends Model('author', {
  id:           field.number(),
  name:         field.string(),
}) {
  create = this.query`INSERT INTO author (name) VALUES (${Author.params.name})`.exec
}

class Book extends Model('book', {
  id:           field.number(),
  title:        field.string(),
  language:     field.string().default('english'),
  published_at: field.datetime().optional(),
  author_id:    field.number().optional(),
}) {
  create = this.query`INSERT INTO book (title, language, published_at, author_id) VALUES (${[Book.params.title, Book.params.language, Book.params.published_at, Book.params.author_id]})`.exec
  get = this.query`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`.one
  set_author = this.query`UPDATE book SET author_id = ${Book.params.author_id} WHERE title = ${Book.params.title}`.exec
}

const InitializationMigration = Migration.create('1.1.0', `
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
  )`)

// later on, we may add a author table
const AddAuthorIdColumnMigration = Migration.create('1.1.0', db => db.exec('ALTER TABLE book ADD COLUMN author_id TEXT REFERENCES author_id(id)'))

class BookORM extends Torm {
  static migrations = {
    version: '1.1.0',
    // an initialization migration is ran on the first database init() call, the first time the database is created
    initialization: InitializationMigration,
    // upgrades are ran when the connected database has an outdated version number
    // upgrades run in order of their semver versions.
    // The latest upgrade version _must_ match the version defined above
    upgrades: [AddAuthorIdColumnMigration],
  }

  book = this.model(Book)
  author = this.model(Author)
}

const db = new BookORM('books.db')
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
