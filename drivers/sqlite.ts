/**
 * @module
 *
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
 */

import * as sqlite3 from 'jsr:@db/sqlite@0.11'
import type { OptionalOnEmpty } from '../src/util.ts'
import { Vars, schema, type SchemaGeneric } from '../src/schema.ts'
import { ModelBase, WithStaticSchema } from '../src/model.ts'
import { StatementBase, type RawRowData } from '../src/statement.ts'
import { TormBase, type SchemasModel, type InitOptions } from '../src/torm.ts'
import { MigrationBase, SeedMigrationBase, type MigrationClass } from '../src/migration.ts'
import { field } from '../src/mod.ts'
import * as errors from '../src/errors.ts'


class Statement<
    Params extends SchemaGeneric,
    Result extends SchemaGeneric
  > extends StatementBase<sqlite3.Statement, Params, Result> {

  public one = (...[params]: OptionalOnEmpty<Params>): Result | undefined => {
    try {
      const row = this.stmt.get<RawRowData>(this.encode_params(params))
      if (row) return this.decode_result(row)
    } catch(e) {
      throw this.parse_exception(params, e)
    }
  }

  public all = (...[params]: OptionalOnEmpty<Params>): Result[] => {
    try {
      return this.stmt.all(this.encode_params(params)).map(this.decode_result)
    } catch (e) {
      throw this.parse_exception(params, e)
    }
  }


  public exec = (...[params]: OptionalOnEmpty<Params>): {changes: number; last_insert_row_id: number} => {
    try {
      const changes = this.stmt.run(this.encode_params(params))
      return {
        changes,
        last_insert_row_id: this.driver.lastInsertRowId
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

  protected prepare = (sql: string): sqlite3.Statement => this.driver.prepare(sql)

  static create = <Params extends SchemaGeneric, Result extends SchemaGeneric>(sql: string, params: Params, result: Result): Statement<Params, Result> => {
    return new Statement<Params, Result>(sql, params, result)
  }
}

// TODO see if we can make this abstract for the mixin
abstract class DriverModel extends ModelBase {
  protected create_stmt = Statement.create
}

class TempModelNonAbstract extends DriverModel {}
const Model = WithStaticSchema(TempModelNonAbstract)

abstract class SeedMigration extends SeedMigrationBase {
  protected create_stmt = Statement.create
}

abstract class Migration extends MigrationBase {
  protected create_stmt = Statement.create
}

class SqliteMasterModel extends Model('sqlite_master', {
  name: field.string(),
  sql: field.string(),
}) {}
class InitializeTormMetadata extends Migration {
  version = '0.1.0'
  call(driver?: sqlite3.Database) {
    if (!driver) throw new Error('Cannot initialize torm metadata without passing driver')
    driver.run(`
      CREATE TABLE IF NOT EXISTS __torm_metadata__ (
        singleton INTEGER NOT NULL UNIQUE DEFAULT 1 CHECK (singleton = 1), -- ensure only a single row can exist
        torm_version TEXT NOT NULL,
        version TEXT,
        updated_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
        created_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
      )`)
    driver.prepare(`INSERT INTO __torm_metadata__ (torm_version) VALUES (:torm_version)`).run({
      torm_version: this.version
    })
  }
}

interface SchemaTable {
  table_name: string
  table_schema: string
}
class SchemasModelImpl extends Model('__torm_metadata__', {
  version: field.string(),
  updated_at: field.datetime(),
  created_at: field.datetime(),
}) implements SchemasModel {

  static override migrations = {
    version: '0.1.0',
    initialization: InitializeTormMetadata
  }

  private _tables = this.query`SELECT ${SqliteMasterModel.result['*']} FROM sqlite_master ORDER BY name`

  unsafe_version_set(version: string) {
    this.prepare`UPDATE __torm_metadata__ SET version = ${SchemasModelImpl.params.version}`.exec({ version })
  }

  version(): string {
    return this.prepare`SELECT ${SchemasModelImpl.result.version} FROM __torm_metadata__`.one({})!.version
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

class Torm extends TormBase<sqlite3.Database> {
  public constructor(private db_path: string, private options: sqlite3.DatabaseOpenOptions = {}) {
    super()
  }

  // deno-lint-ignore require-await
  public async init(options?: InitOptions) {
    const driver = new sqlite3.Database(this.db_path, this.options)
    // await driver.connect()
    this._init(driver, options)
    this.schemas.version()
  }

  public close_driver() { this.driver.close() }

  protected schemas_class = SchemasModelImpl
  public schemas: SchemasModel = new SchemasModelImpl(this)
}

export {
  Torm,
  Statement,
  Model,
  DriverModel,
  Migration,
  SeedMigration,
}

export * as errors from '../src/errors.ts'

type Database = sqlite3.Database
export type { Database as Driver }
export { field }
export { Vars }
export { schema }
export { MigrationError, MigrationValidationError } from '../src/migration.ts'
export type { InferSchemaTypes, SchemaFieldGeneric } from '../src/schema.ts'
export type { SchemaGeneric as Fields }
