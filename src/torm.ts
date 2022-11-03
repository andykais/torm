import type { Constructor, Driver } from './util.ts'
import type { ModelClass, ModelInstance } from './model.ts'
import type { MigrationClass } from './migration.ts'
import { ModelBase } from './model.ts'
import * as semver from "https://deno.land/std@0.161.0/semver/mod.ts";

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
  private model_class_registry: ModelClass[] = []
  private model_registry: ModelInstance[] = []

  static migrations?: {
    version: string
    initialization?: MigrationClass
    upgrades?: MigrationClass[]
  }

  protected model<T extends ModelClass>(model_class: T): InstanceType<T> {
    const model = new model_class()
    this.model_class_registry.push(model_class)
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
      if (current_version === null) {
        if (thisConstructor.migrations?.initialization) {
          const migration = new thisConstructor.migrations.initialization()
          migration.prepare_queries(driver)
          migration.call()
        }
        for (const model_class of this.model_class_registry) {
          if (model_class.migrations?.initialization) {
            const migration = new model_class.migrations.initialization()
            migration.prepare_queries(driver)
            migration.call()
          }
        }
      } else if (this.version_less_than(current_version, application_version)) {
        const migrations = (thisConstructor.migrations?.upgrades ?? []).map(m => new m())
        migrations.sort((a, b) => semver.compare(a.version, b.version))
        for (const migration of migrations) {
          if (semver.gt(migration.version, current_version)) {
            migration.prepare_queries(driver)
            migration.call()
          }
        }

      }
      this.schemas.unsafe_version_set(application_version)
    }

    for (const model of this.model_registry) {
      model.prepare_queries(driver)
    }
  }
  private version_less_than(version_prev: string, version_next: string) {
    const result = semver.compare(version_prev, version_next)
    console.log('version_less_than', version_prev, '<', version_next, result)
    return result < 0
  }
}


export { TormBase }
export type { SchemasModel }
