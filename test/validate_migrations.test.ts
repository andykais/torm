import { test, assert_equals, assert_throws } from './util.ts'
import { Model, Torm, Migration, SeedMigration, MigrationValidationError, field } from '../drivers/sqlite.ts'
import { MigrationRegistry } from '../src/migration.ts';


class Book extends Model('book', {
  id:    field.number(),
  title: field.string(),
}) {
  list = this.query`SELECT ${Book.result['*']} FROM book`.all
}


test('upgrade migration versions must not exceed the seed migration version', (ctx) => {

  class BookORM extends Torm {
    static migrations = new MigrationRegistry()
    book = this.model(Book)
  }

  @BookORM.migrations.register()
  class InitBookMigration1 extends SeedMigration {
    version = '1.0.0'

    call = () => this.driver.exec(`CREATE TABLE book (
      id INTEGER NOT NULL PRIMARY KEY,
      title TEXT NOT NULL
    )`)
  }

  assert_throws(() => {
    @BookORM.migrations.register()
    class AccidentalFutureMigration extends Migration {
      version = '1.2.0'
      call = () => this.driver.exec(`ALTER TABLE book ADD COLUMN genre TEXT`)
    }
  }, MigrationValidationError)
})

test('newest upgrade version must match seed migrations version', async (ctx) => {
  const db_1_0_0 = ctx.create_fixture_path('migrations_1.0.0.db')
  await Deno.copyFile(ctx.resources.books_db_1_0_0, db_1_0_0)

  class BookORM extends Torm {
    static migrations = new MigrationRegistry()
    book = this.model(Book)
  }

  @BookORM.migrations.register()
  class InitBookMigration2 extends SeedMigration {
    version = '1.2.0'

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
    version = '1.1.0'
    call = () => this.driver.exec(`ALTER TABLE book ADD COLUMN genre TEXT`)
  }

  // tihs should fail because we are missing a 1.2.0 upgrade, no database actions have been taken yet
  const db_old = new BookORM(db_1_0_0)
  assert_throws(() => db_old.migrations.validate(), MigrationValidationError)

  // adding in our migration to the latest version will now work
  @BookORM.migrations.register()
  class AddPageCountMigration extends Migration {
    version = '1.2.0'
    call = () => this.driver.exec(`ALTER TABLE book ADD COLUMN page_count TEXT`)
  }

  db_old.close()

  const db_old_with_current_migration = new BookORM(db_1_0_0)
  db_old_with_current_migration.init({auto_migrate: false})
  db_old_with_current_migration.migrations.validate()
  await db_old_with_current_migration.init()
  db_old_with_current_migration.close()
})

test('fresh dbs should not touch upgrade migrations', async (ctx) => {

  class BookORM extends Torm {
    static migrations = new MigrationRegistry()
    book = this.model(Book)
  }

  @BookORM.migrations.register()
  class InitBookMigration extends SeedMigration {
    version = '1.2.0'

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
    version = '1.2.0'
    call = () => { throw new Error('do not take this codepath') }
  }

  const db = new BookORM(ctx.create_fixture_path('test.db'))
  await db.init()
  assert_equals([], db.book.list())
})
