import { test, assert_equals } from './util.ts'
import { Model, Torm, SeedMigration, field, MigrationRegistry, schema } from '../drivers/sqlite.ts'


class Person extends Model {
  static schema = schema('person', {
    id:         field.number(),
    name:       field.string(),
    address:    field.schema({
      country:    field.string(),
      zipcode:    field.number(),
      street:     field.string(),
      updated_at: field.datetime(),
      optional_1: field.string().optional(),
      optional_2: field.string().optional(),
      default_1: field.string().default('default_val'),
      default_2: field.string().default('default_val'),
      nested:     field.schema({
        foobar: field.string(),
        a_date: field.datetime().optional(),
        metadata: field.json().optional(),
      })
    })
  })

  create = this.query`INSERT INTO person (name, address) VALUES (${[Person.schema.params.name, Person.schema.params.address]})`.exec
  get = this.query`SELECT ${Person.schema.result['*']} FROM person WHERE id = ${Person.schema.params.id}`.one
}


class ORM extends Torm {
  person = this.model(Person)
}


const migrations = new MigrationRegistry()
@migrations.register()
class ORMSeedMigration extends SeedMigration {
  version = 1

  call = () => this.prepare`
    CREATE TABLE person (
      id INTEGER NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL
    )
  `.exec()
}


test('schemas should serialize all field types', (ctx) => {
  const db = new ORM(ctx.create_fixture_path('usage.db'), {migrations})
  db.init()

  const address = {
    country: 'USA',
    zipcode: 12345,
    street: '1 Main Street',
    updated_at: new Date(),
    optional_1: 'foo',
    default_1: 'hi',
    nested: {
      foobar: 'foo'
    }
  }
  const person_id = db.person.create({
    name: 'Bob',
    address,
  }).last_insert_row_id

  const person = db.person.get({id: person_id})
  assert_equals(person?.name, 'Bob')
  assert_equals(person?.address, {
    ...address,
    default_2: 'default_val'
  })
  db.close()
})
