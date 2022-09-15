import { sqlite_native } from '../../dependencies.ts'
import type { BuiltSchemaField, SchemaGeneric } from '../../schema.ts'
import { ModelBase } from '../../model.ts'
import { StatementBase } from '../../statement.ts'


class Statement<Params extends SchemaGeneric, Result extends SchemaGeneric> extends StatementBase<Params, Result> {
  public constructor(private stmt: sqlite_native.PreparedStatement<any>, public params: Params) {
    super()
  }

  private get_param(field_name: string) {
    const field = this.params[field_name]
    if (field) return field
    throw new Error(`Field ${field_name} does not exist in params list (${Object.keys(this.params)})`)
  }

  protected encode_params(params: Params) {
    const encoded_params: {[field: string]: any} = {}
    for (const [key, val] of Object.entries(params)) {
      const field = this.get_param(key)
      encoded_params[key] = this.params[key].encode.parse(val)
    }
    return encoded_params
  }

  one = (params: Params) => {
    const encoded_params = this.encode_params(params)
    return this.stmt.one(encoded_params)
  }

  all = (params: Params) => {
    return {} as any
  }

  exec = (params: Params) => {
    return {} as any
  }
}

abstract class Model extends ModelBase {


  protected prepare<Params extends SchemaGeneric, Result extends SchemaGeneric>(sql: string, params: Params, result: Result) {
    const stmt = this.driver.prepare(sql)
    return new Statement<Params, Result>(stmt, params)
  }
}

export { Statement, Model }
