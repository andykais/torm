import { sqlite_native } from '../../dependencies.ts'
import type { BuiltSchemaField, SchemaGeneric } from '../../schema.ts'
import { ModelBase, WithStaticSchema } from '../../model.ts'
import { StatementBase } from '../../statement.ts'
import { TormBase } from '../../torm.ts'
import { Database } from '../../../../sqlite-native/src/database.ts'

type PreparedStatement = sqlite_native.PreparedStatement<any>


class Torm extends TormBase<sqlite_native.Database> {
  public constructor(private db_path: string, private options: sqlite_native.DatabaseOptions = {}) {
    super()
  }

  public async init() {
    const driver = new Database(this.db_path, this.options)
    await driver.connect()
    super.init(driver)
  }
}


class Statement<Params extends SchemaGeneric, Result extends SchemaGeneric> extends StatementBase<PreparedStatement, Params, Result> {
  public one = (params: Params) => this.decode_result(this.stmt.one(this.encode_params(params)))

  public all = (params: Params) => this.stmt.all(this.encode_params(params)).map(this.decode_result)

  public exec = (params: Params) => this.stmt.exec(this.encode_params(params))

  protected prepare = (sql: string) => this.driver.prepare(sql)

}

// TODO see if we can make this abstract for the mixin
abstract class Model extends ModelBase {

  protected create_stmt<Params extends SchemaGeneric, Result extends SchemaGeneric>(sql: string, params: Params, result: Result) {
    return new Statement<Params, Result>(sql, params, result)
  }
}

class TempModelNonAbstract extends Model {}
const ModelMixin = WithStaticSchema(TempModelNonAbstract)

export {
  Torm,
  Statement,
  // Model
  ModelMixin as Model
}
