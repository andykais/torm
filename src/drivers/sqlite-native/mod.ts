import { sqlite_native } from '../../dependencies.ts'
import type { BuiltSchemaField, SchemaGeneric } from '../../schema.ts'
import { ModelBase, WithStaticSchema } from '../../model.ts'
import { StatementBase } from '../../statement.ts'


class Statement<Params extends SchemaGeneric, Result extends SchemaGeneric> extends StatementBase<Params, Result> {
  public constructor(private stmt: sqlite_native.PreparedStatement<any>, public params: Params) {
    super()
  }

  one = (params: Params) => this.stmt.one(this.encode_params(params))


  all = (params: Params) => this.stmt.all(this.encode_params(params))


  exec = (params: Params) => this.stmt.exec(this.encode_params(params))
}

// TODO see if we can make this abstract for the mixin
abstract class Model extends ModelBase {

  protected prepare<Params extends SchemaGeneric, Result extends SchemaGeneric>(sql: string, params: Params, result: Result) {
    const stmt = this.driver.prepare(sql)
    return new Statement<Params, Result>(stmt, params)
  }
}

class TempModelNonAbstract extends Model {}
const ModelMixin = WithStaticSchema(TempModelNonAbstract)

export {
  Statement,
  // Model
  ModelMixin as Model
}
