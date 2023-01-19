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
    - [X] `sqlite-native`
    - [ ] `better-sqlite3`
