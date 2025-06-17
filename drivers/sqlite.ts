/**
 * This module contains the torm interface for sqlite databases
 *
 * @example
 * ```ts
 * import { Torm, Model, field } from 'jsr:@andykais/torm/sqlite'
 * 
 * 
 * class Book extends Model('book', {
 *   id:           field.number(),
 *   title:        field.string(),
 *   language:     field.string().default('english'),
 *   published_at: field.datetime().optional(),
 * }) {
 *   create = this.query.exec`INSERT INTO book (title, language, published_at) VALUES (${[Book.params.title, Book.params.language, Book.params.published_at]})`
 *   get = this.query.one`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`
 *   list = this.query.many`SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}`
 * }
 * 
 * 
 * class BookORM extends Torm {
 *   book = this.model(Book)
 * }
 * 
 * const db = new BookORM('books.db')
 * await db.init()
 * const info = db.book.create({ title: 'The Hobbit', published_at: new Date('September 21, 1937') })
 * const row = db.book.get({ id: info.last_insert_row_id })
 * 
 * console.log(row?.title, 'written in', row?.language, 'published on', row?.published_at)
 * // "The Hobbit written in english published on 1937-09-21T04:00:00.000Z"
 * ```
 *
 * @module
 */

import * as sqlite3 from 'node:sqlite'
import * as path from 'node:path'
import type { OptionalOnEmpty } from '../src/util.ts'
import { Vars, schema, type SchemaGeneric } from '../src/schema.ts'
import { ModelBase } from '../src/model.ts'
import { StatementBase, type RawRowData } from '../src/statement.ts'
import { TormBase, type SchemasModel, type InitOptions, type TormOptions } from '../src/torm.ts'
import { MigrationBase, MigrationRegistry, SeedMigrationBase } from '../src/migration.ts'
import { field } from '../src/mod.ts'
import * as errors from '../src/errors.ts'


class Statement<
    Params extends SchemaGeneric,
    Result extends SchemaGeneric
  > extends StatementBase<sqlite3.StatementSync, Params, Result> {

  public one = (...[params]: OptionalOnEmpty<Params>): Result | undefined => {
    try {
      const row = this.stmt.get(this.encode_params(params)) as RawRowData
      if (row) return this.decode_result(row)
    } catch(e) {
      throw this.parse_exception(params, e)
    }
  }

  public all = (...[params]: OptionalOnEmpty<Params>): Result[] => {
    try {
      const rows = this.stmt.all(this.encode_params(params)) as RawRowData[]
      return rows.map(this.decode_result)
    } catch (e) {
      throw this.parse_exception(params, e)
    }
  }


  public exec = (...[params]: OptionalOnEmpty<Params>): {changes: number; last_insert_row_id: number} => {
    try {
      const info = this.stmt.run(this.encode_params(params))
      return {
        changes: info.changes as number,
        last_insert_row_id: info.lastInsertRowid as number
      }
    } catch (e) {
      throw this.parse_exception(params, e)
    }
  }

  private parse_exception(params: any, error: unknown) {
    if (!(error instanceof Error)) return new Error(`unexpected error`, { cause: error })
    if (error.message.includes('UNIQUE constraint failed')) {
      return new errors.UniqueConstraintError(this.sql, params, error.message)
    }
    return new errors.QueryError(this.sql, params, error.message)
  }

  protected prepare = (sql: string): sqlite3.StatementSync => this.driver.prepare(sql)

  static create = <Params extends SchemaGeneric, Result extends SchemaGeneric>(sql: string, params: Params, result: Result): Statement<Params, Result> => {
    return new Statement<Params, Result>(sql, params, result)
  }
}

/**
  * Models are the representation of tables and queries in Torm.
  *
  * @example
  * ```ts
  * class Account extends Model {
  *   static schema = schema('author', {
  *     id:           field.number(),
  *     name:         field.string(),
  *   })
  *
  *   create = this.query.exec`INSERT INTO author (name) VALUES (${Author.schema.params.name})`
  * }
  * ```
  */
abstract class Model extends ModelBase {
  protected create_stmt = Statement.create
}

/**
  * SeedMigrations are specifically designed to be ran on the initial creation of a database. These should create all the relevant tables, indexes, triggers that you intend for your database.
  *
  * @example
  * ```ts
  * const migrations = new MigrationRegistry()
  *
  * @migrations.register()
  * class InitializationMigration extends SeedMigration {
  *   version = '1.1.0'
  *
  *   call() {
  *     this.driver.exec(`
  *       CREATE TABLE author (
  *         id INTEGER NOT NULL PRIMARY KEY,
  *         name TEXT NOT NULL
  *       );
  *
  *       CREATE TABLE book (
  *         id INTEGER NOT NULL PRIMARY KEY,
  *         title TEXT NOT NULL,
  *         data TEXT,
  *         language TEXT NOT NULL,
  *         published_at TEXT,
  *         author_id INTEGER,
  *         FOREIGN KEY(author_id) REFERENCES author(id)
  *       )`
  *     )
  *   }
  * }
  * ```
  */
abstract class SeedMigration extends SeedMigrationBase {
  protected create_stmt = Statement.create
}

/**
  * Migrations are used to upgrade your database structure as you roll out new versions of code. These can be ran automatically, programatically. Torm currently only supports forward migrations. At the end of the day, this class essentially just wraps logic around version numbers and a function call with access to a database driver.
  * @example
  * ```ts
  * const migrations = new MigrationRegistry()
  *
  * @migrations.register()
  * class AddNewColumnMigration extends Migration {
  *   version = '1.1.0'
  *
  *   call() {
  *     this.driver.exec(`ALTER TABLE book ADD COLUMN genre TEXT`)
  *   }
  * }
  *
  * class BookORM extends Torm {}
  *
  * const db = new BookORM('books.db', {migrations})
  * db.init({auto_migrate: false}) // this will prevent torm from automatically running migrations upon startup
  * // this is the general workflow for migrating manually:
  * const current_db_version = db.schemas.version()
  * if (db.migrations.is_database_outdated()) {
  *   db.migrations.upgrade_database()
  * }
  *
  * ```
  */
abstract class Migration extends MigrationBase {
  protected create_stmt = Statement.create
}


const migrations_internal = new MigrationRegistry()

class SqliteMasterModel extends Model {
  static schema = schema('sqlite_master', {
    name: field.string(),
    sql: field.string(),
  })
}

@migrations_internal.register()
class InitializeTormMetadata extends SeedMigration {
  version = '0.1.0'
  call(driver?: sqlite3.DatabaseSync) {
    if (!driver) throw new Error('Cannot initialize torm metadata without passing driver')
    driver.exec(`
      CREATE TABLE IF NOT EXISTS __torm_metadata__ (
        singleton INTEGER NOT NULL UNIQUE DEFAULT 1 CHECK (singleton = 1), -- ensure only a single row can exist
        torm_version TEXT NOT NULL,
        version TEXT,
        updated_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
        created_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
      )`)
    driver.exec(`INSERT INTO __torm_metadata__ (torm_version) VALUES ('${this.version}')`)
  }
}

interface SchemaTable {
  table_name: string
  table_schema: string
}
const torm_metadata_schema = schema('__torm_metadata__', {
  version: field.string(),
  updated_at: field.datetime(),
  created_at: field.datetime(),
})
class SchemasModelImpl extends Model implements SchemasModel {
  private _tables = this.query`SELECT ${SqliteMasterModel.schema.result['*']} FROM sqlite_master ORDER BY name`

  unsafe_version_set(version: string) {
    this.prepare`UPDATE __torm_metadata__ SET version = ${torm_metadata_schema.params.version}`.exec({ version })
  }

  version(): string {
    return this.prepare`SELECT ${torm_metadata_schema.result.version} FROM __torm_metadata__`.one({})!.version
  }

  table(table_name: string): SchemaTable | undefined {
    return this.tables().find(t => t.table_name === table_name)
    // const table_row = this._tables.one({})
    // if (table_row) return this.parse_table_sql(table_row)
  }

  tables(): SchemaTable[] {
    const tables = this._tables.all({})
      .filter(row => row.sql !== null) // skip the builtin auto definitions
      .map(this.parse_table_sql)
    tables.sort((a, b) => a.table_name.localeCompare(b.table_name))
    return tables
  }

  private parse_table_sql = (row: { name: string; sql: string }) => {
    let { sql } = row
    sql = sql.replace(/^\s+/mg, '') // remove excess whitespace
    sql = sql.replace(/CREATE TABLE "(.*?)"/g, (_, name) => `CREATE TABLE ${name}`) // remove optional quotes around table name
    sql = sql.replace(/CREATE TABLE ([a-z_]+) \(([\s\S]+)\)/gm, (_, name, columns_str: string) => {
      const columns = columns_str
      .trim()
      .split(/\n/)
      .map(col => col.trim())
      .filter(col => !col.startsWith('--'))
      .flatMap(col => {
        const inlined_columns: string[] = []
        let last_column_index = 0
        let paren_count = 0
        for (let i = 0; i < col.length; i++) {
          const char = col[i]
          switch(char) {
            case '(':
              paren_count++
              break
            case ')':
              paren_count--
              break
            case ',':
              if (paren_count === 0) {
                inlined_columns.push(col.substring(last_column_index, i).trim())
                last_column_index = i + 1
              }
              break
          }
        }
        if (last_column_index > col.length) inlined_columns.push(col.substring(last_column_index))
        return inlined_columns
        })
      columns.sort((a, b) => {
        if (a.startsWith('id')) return -1
        else if (b.startsWith('id')) return 1
        else if (a.startsWith('FOREIGN KEY')) return 1
        else if (b.startsWith('FOREIGN KEY')) return -1
        else return a.localeCompare(b)
      })
      const table_definition = `CREATE TABLE ${name} (
${columns.join('\n  ')}
)`
      return table_definition
    })
    return { table_name: row.name, table_schema: sql }
  }
}

/**
  * The main entrypoint for using torm. All models are attached to this class and it is used to instantiate, migrate, and connect to your database.
  *
  * @example
  * ```ts
  * import { Torm, Model, Migration, SeedMigration, field } from 'jsr:@torm/sqlite'
  *
  * class Account extends Model {
  *   static schema = schema('author', {
  *     id:           field.number(),
  *     name:         field.string(),
  *   })
  *
  *   create = this.query.exec`INSERT INTO author (name) VALUES (${Author.schema.params.name})`
  * }
  *
  * class UsersORM extends Torm {
  *   account = this.model(Account) // attach models with Torm::model
  * }
  *
  * const db = new UsersORM('books.db')
  * db.init() // initialize your database connection (by default, migrations are ran automatically on initialization)
  * db.account.create({name: 'Bob Ross'}) // access prepared statements on models
  * db.close() // close down your database connection
  * ```
  */
class Torm extends TormBase<sqlite3.DatabaseSync> {
  public constructor(private db_path: string, torm_options: TormOptions = {}, private sqlite_options: sqlite3.DatabaseSyncOptions = {}) {
    torm_options.migrations = torm_options.migrations ?? new MigrationRegistry()
    super({...torm_options, migrations_internal})
    this.sqlite_options = {readOnly: false, ...this.sqlite_options}
  }

  // deno-lint-ignore require-await
  public async init(options?: InitOptions) {
    const driver = new sqlite3.DatabaseSync(this.db_path, this.sqlite_options)
    this._init(driver, options)
    this.schemas.version()
  }

  public close_driver() {
    this.driver.close()
  }

  public override backup(folder: string, name: string) {
    const backup_name = this.get_backup_name(folder, name)
    const backup_path = path.join(folder, backup_name)
    Deno.mkdirSync(folder, {recursive: true})
    try {
      this.driver.exec(`PRAGMA locking_mode = EXCLUSIVE`)
      Deno.copyFileSync(this.db_path, backup_path)
    } finally {
      this.driver.exec(`PRAGMA locking_mode = NORMAL`)
    }
  }

  private get_backup_name(folder: string, name: string, suffix?: number): string {
    const now = new Date()
    let backup_name = `${now.getUTCFullYear()}-${now.getUTCMonth().toString().padStart(2, '0')}-${now.getUTCDay().toString().padStart(2, '0')}_${name}`
    if (suffix) {
      backup_name += '_' + suffix
    }
    try {
      const backup_path = path.join(folder, backup_name)
      Deno.statSync(backup_path)
      suffix = (suffix ?? 0) + 1
      return this.get_backup_name(folder, name, suffix)
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        return backup_name
      } else {
        throw e
      }
    }
  }

  protected schemas_class = SchemasModelImpl
  public schemas: SchemasModel = new SchemasModelImpl(this)
}

export {
  Torm,
  Statement,
  Model,
  Migration,
  SeedMigration,
}

export * as errors from '../src/errors.ts'

/** Underlying sqlite driver {@link https://jsr.io/@db/sqlite} */
export type Driver = sqlite3.DatabaseSync
export { field }
export { Vars }
export { schema }
export { MigrationError, MigrationValidationError, MigrationRegistry } from '../src/migration.ts'
export type { InferSchemaTypes, SchemaFieldGeneric } from '../src/schema.ts'
export type { SchemaGeneric as Fields }
