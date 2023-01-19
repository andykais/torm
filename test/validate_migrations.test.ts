import { test, assert_equals, assert_rejects } from './util.ts'
import { Model, Torm, Migration, field } from '../drivers/sqlite.ts'


const InitBookMigration = Migration.create('1.0.0', `
  CREATE TABLE book (
    id INTEGER NOT NULL PRIMARY KEY,
    title TEXT NOT NULL
  )`)
class Book extends Model('book', {
  id:    field.number(),
  title: field.string(),
}) {
}


class BookORM extends Torm {
  static migrations = {
    version: '1.1.0',
    initialization: InitBookMigration,
    upgrades: [] as (typeof InitBookMigration)[]
  }

  book = this.model(Book)
}


test('incompatible migration versions', async (ctx) => {
  const db = new BookORM(ctx.fixture_path('test.db'))
  await assert_rejects(() => db.init())
  db.close()

  // update the version number and our error goes away
  BookORM.migrations.initialization = Migration.create('1.1.0', `
    CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      title TEXT NOT NULL
    )`)
  const db_fixed = new BookORM(ctx.fixture_path('test.db'))
  await db_fixed.init()
  db_fixed.close()
})


test('out of sync future migration versions', async (ctx) => {
  const InitBookMigration = Migration.create('1.1.0', `
    CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      title TEXT NOT NULL
    )`)
  const AccidentalFutureMigration = Migration.create('1.2.0', `ALTER TABLE book ADD COLUMN genre TEXT`)

  BookORM.migrations = {
    version: '1.1.0',
    initialization: InitBookMigration,
    upgrades: [AccidentalFutureMigration],
  }
  const db = new BookORM(ctx.fixture_path('test.db'))
  await assert_rejects(() => db.init())
  db.close()

  // lets try creating our db now without any upgrades
  BookORM.migrations.upgrades = []
  const db_no_upgrades = new BookORM(ctx.fixture_path('test.db'))
  await db_no_upgrades.init()
  assert_equals(db_no_upgrades.schemas.version(), '1.1.0')
  db_no_upgrades.close()

  // now, if we change the application version to match our upgrade, and include the upgrade, we will run it
  BookORM.migrations = {
    version: '1.2.0',
    initialization: Migration.create('1.2.0', () => {throw new Error('dont take this code path!')}),
    upgrades: [AccidentalFutureMigration],
  }
  const db_upgraded = new BookORM(ctx.fixture_path('test.db'))
  await db_upgraded.init()
  assert_equals(db_upgraded.schemas.version(), '1.2.0')
  db_upgraded.close()
})

test('no upgrade migrations', async (ctx) => {
  const InitBookMigration = Migration.create('1.2.0', `
    CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      title TEXT NOT NULL,
      genre TEXT
    )`)
  BookORM.migrations = {
    version: '1.2.0',
    initialization: InitBookMigration,
    upgrades: [Migration.create('1.1.0', () => { throw new Error('dont take this code path!') })]
  }
  const db = new BookORM(ctx.fixture_path('test.db'))
  await assert_rejects(() => db.init())
  db.close()

  // adding an upgrade migration matching the current application version should remove our exceptions
  BookORM.migrations.upgrades.push(Migration.create('1.2.0', () => { throw new Error('dont take this code path either!')}))
  const db_fixed = new BookORM(ctx.fixture_path('test.db'))
  await db_fixed.init()
  db_fixed.close()
})
