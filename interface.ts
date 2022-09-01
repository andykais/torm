import {
  // model definition stuff (tbd if we need a Schema and Queries)
  Model, field, z, Schema, Queries,
  // tagged template literal functions
  select, update,
  // string template args
  fields, param
} from 'modo'

// the question is, can we create a typesafe orm based off of this?

class FooBar extends Model {
  static schema = {
    id: field(z.number()),
    foo: field(z.string()),
    bar: field(z.number()),
    baz_id: Baz.schema.id
  }

  queries = {
    select_one: select`SELECT ${fields(FooBar.schema.foo, FooBar.schema.bar)} FROM foobar`,
    select_one_join: select`
      SELECT ${fields(FooBar.schema.foo, FooBar.schema.bar, Baz.schema.baz)} FROM foobar
      INNER JOIN baz.id = 
      WHERE baz.id = foobar.baz_id AND foo = ${param(FooBar.schema.foo)}`,
    update_one: update`UPDATE foobar SET
      foo = ${param(FooBar.schema.foo)}
      bar = ${param(FooBar.schema.bar)}`,
  }
}

class Baz extends Model {
  static schema = {
    id: field(z.number()),
    baz: field(z.datetime()),
    jazz: field(z.string()),
  }

  queries = {
    insert_one: update`INSERT INTO foobar (baz, jazz) VALUES (${param(Baz.schema.baz, Baz.schema.jazz)})`
  }
}

// either classes + context
const foobar = FooBar.queries.select_one(context)
console.log(foobar.foo, foobar.bar)

const foobar = FooBar.queries.select_one_join(context)
console.log(foobar.foo, foobar.bar)

const info = FooBar.queries.update_one({ foo: 'foo', bar: 1 })
console.log(info.changes, info.lastInsertRowId)

// or top level registry (leaning this way tbh)
const driver = new SqliteNative()
await driver.connect()
const db = await torm(driver, {
  Baz,
  FooBar
})

const db = new Database('test.db')
db.models.Baz.insert_one({ baz: new Date(), jazz: 'test' })
