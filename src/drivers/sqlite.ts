import type { OptionalOnEmpty } from '../util.ts'
import type { BuiltSchemaField, SchemaGeneric } from '../schema.ts'
import { sqlite_native } from '../dependencies.ts'
import { ModelBase, WithStaticSchema } from '../model.ts'
import { StatementBase } from '../statement.ts'
import { TormBase, type SchemasModel, type InitOptions } from '../torm.ts'
import { SQLiteNativeDriver as Database } from '../dependencies.ts'
import { MigrationBase, type MigrationClass } from '../migration.ts'
import { field } from '../mod.ts'


class Statement<
    Params extends SchemaGeneric,
    Result extends SchemaGeneric
  > extends StatementBase<sqlite_native.PreparedStatement, Params, Result> {

  public one = (...[params]: OptionalOnEmpty<Params>): Result | undefined => {
    const row = this.stmt.one(this.encode_params(params))
    if (row) return this.decode_result(row)
    // throw new Error('undefined one() is unimplemented')
  }

  public all = (...[params]: OptionalOnEmpty<Params>) => this.stmt.all(this.encode_params(params)).map(this.decode_result)


  public exec = (...[params]: OptionalOnEmpty<Params>) => this.stmt.exec(this.encode_params(params))

  protected prepare = (sql: string) => this.driver.prepare(sql)

  static create = <Params extends SchemaGeneric, Result extends SchemaGeneric>(sql: string, params: Params, result: Result) => {
    return new Statement<Params, Result>(sql, params, result)
  }
}

type Constructor<T> = Function & { prototype: T }

// TODO see if we can make this abstract for the mixin
abstract class DriverModel extends ModelBase {
  protected create_stmt = Statement.create
}
class TempModelNonAbstract extends DriverModel {}
const Model = WithStaticSchema(TempModelNonAbstract)

abstract class Migration extends MigrationBase {
  protected create_stmt = Statement.create

  static create(version: string, arg: string | ((driver: Database) => void)): MigrationClass {
    return class InlineMigration extends Migration {
      version = version
      call = () => {
        if (typeof arg === 'string') this.driver.exec(arg)
        else arg(this.driver)
      }
    }
  }
}

class SqliteMasterModel extends Model('sqlite_master', {
  name: field.string(),
  sql: field.string(),
}) {}
class InitializeTormMetadata extends Migration {
  version = '0.1.0'
  call(driver?: Database) {
    if (!driver) throw new Error('Cannot initialize torm metadata without passing driver')
    driver.exec(`
      CREATE TABLE IF NOT EXISTS __torm_metadata__ (
        singleton INTEGER NOT NULL UNIQUE DEFAULT 1 CHECK (singleton = 1), -- ensure only a single row can exist
        torm_version TEXT NOT NULL,
        version TEXT,
        updated_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
        created_at DATETIME NOT NULL DEFAULT(STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
      )`)
    driver.prepare(`INSERT INTO __torm_metadata__ (torm_version) VALUES (:torm_version)`).exec({
      torm_version: this.version
    })
  }
}

class SchemasModelImpl extends Model('__torm_metadata__', {
  version: field.string(),
  updated_at: field.datetime(),
  created_at: field.datetime(),
}) implements SchemasModel {

  static migrations = {
    version: '0.1.0',
    initialization: InitializeTormMetadata
  }

  private _tables = this.query`SELECT ${SqliteMasterModel.result['*']} FROM sqlite_master ORDER BY name`

  unsafe_version_set(version: string) {
    this.prepare`UPDATE __torm_metadata__ SET version = ${SchemasModelImpl.params.version}`.exec({ version })
  }

  version() {
    return this.prepare`SELECT ${SchemasModelImpl.result.version} FROM __torm_metadata__`.one({})!.version
  }

  table(table_name: string) {
    return this.tables().find(t => t.table_name === table_name)
    // const table_row = this._tables.one({})
    // if (table_row) return this.parse_table_sql(table_row)
  }

  tables() {
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

class Torm extends TormBase<sqlite_native.Database> {
  public constructor(private db_path: string, private options: sqlite_native.DatabaseOptions = {}) {
    super()
  }

  public async init(options?: InitOptions) {
    const driver = new Database(this.db_path, this.options)
    await driver.connect()
    this._init(driver, options)
    this.schemas.version()
  }

  public close() { this.driver.close() }

  protected schemas_class = SchemasModelImpl
  public schemas: SchemasModel = new SchemasModelImpl(this)
}

export {
  Torm,
  Statement,
  Model,
  Migration,
}

export type { Database as Driver }
