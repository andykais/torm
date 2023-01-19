# TORM
A typesafe database ORM that exposes the full power of handwritten sql statements to the developer.

```ts
import { torm, z } from 'https://deno.land/x/torm/mod.ts'
import { Model } from 'https://deno.land/x/torm/drivers/sqlite-native/mod.ts'


class Author extends Model('author', {
  id:         z.number(),
  first_name: z.string(),
  last_name:  z.string(),
}) {
  create = this.query`INSERT INTO author (first_name, last_name) VALUES (${[Author.params.first_name, Author.params.last_name]})`.exec
  get = this.query`SELECT ${Author.result['*']} FROM author WHERE id = ${Author.params.id}`.one
}


const db = await torm({ author: Author }, 'books.db')
const info = db.author.create({ first_name: 'JR', last_name: 'Tolkein' })
const row = db.author.get({ id: info.last_insert_row_id })
console.log(row.first_name, row.last_name)
```

## Roadmap to 1.0
- [X] `SELECT ${Book.schema.id}` tagged template literal type translation
- [X] `SELECT ${[Book.schema.id, Book.schema.title]}` array param support
- [X] `SELECT ${Book.schema['*']}` helper
- [X] `SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}` param & result nominal types
- [O] runtime implementation
  - [O] driver bridges
    - [X] `sqlite-native` (deno)
    - [ ] `better-sqlite3` (nodejs)
- [ ] migrations framework
  - [ ] Torm metadata table
  - [ ] migration declarations

## Philosophy
This library does not intend to be a set-it-and-forget-it ORM. Production ready applications need developers to understand exactly what queries are being ran against the database. Often this information is shrouded in traditional ORMs and developers end up treating the database like a black box. Torm instead forces developers to write their own queries, but keeps some of the advantages of traditional ORMs by keeping type-safety a first class citizen.

When a team gets to be larger than a single developer working on the backend, queries often need to be reviewed and approved, and this library takes the position that declarative queries are better served than inline queries sprinkled throughout your application.

Besides the benefit of better visibility into queries, this means that Torm can prepare all your queries for free at the time of database connection. This avoids any of the difficulty that systems like Prisma, or Sequelize have around LRU caching of prepared queries (which at the very least are always slow on the first call).

> The first gulp from the glass of **database development** will turn you to **ORMs**, but at the bottom of the glass **raw sql queries** are waiting for you
