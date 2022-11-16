# TORM
A typesafe database ORM that exposes the full power of handwritten sql statements to the developer.



## Getting Started
```ts
import { Torm, Model, field } from 'https://deno.land/x/torm/drivers/sqlite-native/mod.ts'


class Person extends Model('person', {
  id:         field.number(),
  first_name: field.string(),
  last_name:  field.string(),
}) {
  create = this.query`INSERT INTO person (first_name, last_name) VALUES (${[Person.params.first_name, Person.params.last_name]})`.exec
  get = this.query`SELECT ${Person.result['*']} FROM person WHERE id = ${Person.params.id}`.one
}


class PeopleORM extends Torm {
  person = this.model(Person)
}

const db = new PeoplORM('books.db')
await db.init()
const info = db.person.create({ first_name: 'JR', last_name: 'Tolkein' })
const row = db.person.get({ id: info.last_insert_row_id })
console.log(row.first_name, row.last_name)
```


## Migrations
Torm include a full migration system, which is declared like so:
```ts
import { Torm, Model, field } from 'https://deno.land/x/torm/drivers/deno/mod.ts'

const InitializationMigration = Migration.create('1.1.0', `
  CREATE TABLE IF NOT EXISTS author (
    id INTEGER NOT NULL PRIMARY KEY,
    first_name TEXT,
    last_name TEXT NOT NULL,
    address TEXT
  )`)

const AddAddressColumnMigration = Migration.create('1.1.0', 'ALTER TABLE person ADD COLUMN address TEXT')

class PeopleORM extends Torm {
  static migrations = {
    version: '1.1.0',
    // an initialization migration is ran on the first database init() call
    initialization: InitializationMigration,
    // upgrades will be ran in order of their semver versions.
    // The latest upgrade version _must_ match the version defined above
    upgrades: [AddAddressColumnMigration],
  }

  person = this.model(Person)
}
```

## Roadmap
#### 1.0
- [X] `SELECT ${Book.schema.id}` tagged template literal type translation
- [X] `SELECT ${[Book.schema.id, Book.schema.title]}` array param support
- [X] `SELECT ${Book.schema['*']}` helper
- [X] `SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}` param & result type narrowing
- [O] runtime implementation
  - [O] driver bridges
    - [X] `sqlite-native` (deno)
    - [ ] `better-sqlite3` (nodejs)
- [X] migrations framework
  - [X] Torm metadata table
  - [X] migration declarations
#### 2.0
- [ ] driver bridges
  - [ ] Postgres
  - [ ] MySQL

## Philosophy
This library does not intend to be a set-it-and-forget-it ORM. Production ready applications need developers to understand exactly what queries are being ran against the database. Often this information is shrouded in traditional ORMs and developers end up treating the database like a black box. Torm instead forces developers to write their own queries, but keeps some of the advantages of traditional ORMs by keeping type-safety a first class citizen.

When a team gets to be larger than a single developer working on the backend, queries often need to be reviewed and approved, and this library takes the position that declarative queries are better served than inline queries sprinkled throughout your application.

Besides the benefit of better visibility into queries, this means that Torm can prepare all your queries for free at the time of database connection. This avoids any of the difficulty that systems like Prisma, or Sequelize have around LRU caching of prepared queries (which at the very least are always slow on the first call).

> The first gulp from the glass of **database development** will turn you to **ORMs**, but at the bottom of the glass **raw sql queries** are waiting for you
