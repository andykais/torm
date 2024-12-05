import { test, assert_equals } from './util.ts'
import { Torm, SeedMigration, MigrationRegistry } from '../drivers/sqlite.ts'


class EmptyORM extends Torm {}

const migrations = new MigrationRegistry
@migrations.register()
class EmptyMigration extends SeedMigration {
  version = '1.0.0'
  call() {}
}

test('empty torm', async () => {
  await Deno.remove('test/fixtures/empty.db').catch(e => { if (e instanceof Deno.errors.NotFound === false) throw e})
  const db = new EmptyORM('test/fixtures/empty.db', {migrations})
  await db.init()
  assert_equals(db.schemas.version(), '1.0.0')
  db.close()

  const db_reopen = new EmptyORM('test/fixtures/empty.db', {migrations})
  await db_reopen.init()
  assert_equals(db_reopen.schemas.version(), '1.0.0')
  db_reopen.close()
})

