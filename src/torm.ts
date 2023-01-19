import type { Constructor, Driver } from './util.ts'
import type { ModelClass, ModelInstance } from './model.ts'
import type { MigrationClass } from './migration.ts'
import { ModelBase } from './model.ts'

interface TableRow {
  table_name: string
  table_schema: string
}
abstract class SchemasModel extends ModelBase {
  abstract unsafe_version_set(version: string): void
  abstract version(): string
  abstract table(table_name: string): TableRow | undefined
  abstract tables(): TableRow[]
}


abstract class TormBase<D extends Driver> {
  private _driver: D | null = null
  private model_registry: ModelInstance[] = []

  static migrations?: {
    version: string
    initialization?: MigrationClass
    upgrades?: MigrationClass[]
  }

  protected model<T extends ModelClass>(model_class: T): InstanceType<T> {
    const model = new model_class()
    this.model_registry.push(model)
    return model as InstanceType<T>
  }

  public get driver() {
    if (this._driver) return this._driver
    else throw new Error('A driver cannot be instantiated until init() is called')
  }

  protected abstract schemas_class: typeof SchemasModel
  public abstract schemas: SchemasModel

  public init(driver: D) {
    this._driver = driver

    const thisConstructor = this.constructor as typeof TormBase<Driver>
    const application_version = thisConstructor.migrations?.version

    this.schemas.prepare_queries(driver)
    if (this.schemas.table('__torm_metadata__') === undefined) {
      const init_migration = new this.schemas_class.migrations!.initialization!()
      init_migration.prepare_queries(driver)
      init_migration.call()
    }

    if (application_version !== undefined) {
      const current_version = this.schemas.version()
      if (this.schemas.version() === null) {
        if (thisConstructor.migrations?.initialization) {
          const migration = new thisConstructor.migrations.initialization()
          migration.prepare_queries(driver)
          migration.call()
        }
      }
      this.schemas.unsafe_version_set(application_version)
    }

    for (const model of this.model_registry) {
      model.prepare_queries(driver)
    }
  }
}


export { TormBase }
export type { SchemasModel }
