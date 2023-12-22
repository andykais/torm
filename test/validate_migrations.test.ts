import { test, assert_equals, assert_rejects, assert_throws } from './util.ts'
import { Model, Torm, Migration, SeedMigration, MigrationValidationError, field } from '../drivers/sqlite.ts'


class Book extends Model('book', {
  id:    field.number(),
  title: field.string(),
}) {
  list = this.query`SELECT ${Book.result['*']} FROM book`.all
}


test('upgrade migration versions must not exceed the seed migration version', async (ctx) => {

  class BookORM extends Torm {
    book = this.model(Book)
  }

  @BookORM.migrations.register()
  class InitBookMigration extends SeedMigration {
    static version = '1.0.0'

    call = () => this.driver.exec(`CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      title TEXT NOT NULL
    )`)
  }

  assert_throws(() => {
    @BookORM.migrations.register()
    class AccidentalFutureMigration extends Migration {
      static version = '1.2.0'
      call = () => this.driver.exec(`ALTER TABLE book ADD COLUMN genre TEXT`)
    }
  }, MigrationValidationError)
})

test('newest upgrade version must match seed migrations version', async (ctx) => {
  const db_1_0_0 = ctx.fixture_path('migrations_1.0.0.db')
  await Deno.copyFile(ctx.resources.books_db_1_0_0, db_1_0_0)

  class BookORM extends Torm {
    book = this.model(Book)
  }

  @BookORM.migrations.register()
  class InitBookMigration extends SeedMigration {
    static version = '1.2.0'

    table_sql = `CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      title TEXT NOT NULL,
      genre TEXT,
      page_count TEXT
    )`
    call = () => { throw new Error('do not run the seed migration') }
  }

  @BookORM.migrations.register()
  class AddGenreMigration extends Migration {
    static version = '1.1.0'
    call = () => this.driver.exec(`ALTER TABLE book ADD COLUMN genre TEXT`)
  }

  // tihs should fail because we are missing a 1.2.0 upgrade, no database actions have been taken yet
  const db_old = new BookORM(db_1_0_0)
  assert_throws(() => Migration.validate(db_old), MigrationValidationError)

  // adding in our migration to the latest version will now work
  @BookORM.migrations.register()
  class AddPageCountMigration extends Migration {
    static version = '1.2.0'
    call = () => this.driver.exec(`ALTER TABLE book ADD COLUMN page_count TEXT`)
  }

  Migration.validate(db_old)
  await db_old.init()
  db_old.close()
})

test('fresh dbs should not touch upgrade migrations', async (ctx) => {

  class BookORM extends Torm {
    book = this.model(Book)
  }

  @BookORM.migrations.register()
  class InitBookMigration extends SeedMigration {
    static version = '1.2.0'

    create_table = this.query`CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      title TEXT NOT NULL,
      genre TEXT,
      page_count TEXT
    )`

    call = () => this.create_table.exec()
  }

  @BookORM.migrations.register()
  class AddGenreMigration extends Migration {
    static version = '1.2.0'
    call = () => { throw new Error('do not take this codepath') }
  }

  const db = new BookORM(ctx.fixture_path('test.db'))
  await db.init()
  assert_equals([], db.book.list())
})
