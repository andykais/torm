import type { Constructor, Driver } from './util.ts'
import type { ModelClass, ModelInstance } from './model.ts'
import type { Version, MigrationClass, MigrationInstance, MigrationRegistry } from './migration.ts'
import { ModelBase } from './model.ts'
import { Migration } from './drivers/sqlite-native/mod.ts';

interface InitOptions {
  auto_migrate?: boolean
}

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
  private status: 'uninitialized' | 'outdated' | 'initialized' = 'uninitialized'
  private _driver: D | null = null
  private model_class_registry: ModelClass[] = []
  private model_registry: ModelInstance[] = []
  private initialization_migrations: MigrationInstance[] = []
  private upgrades_migrations: MigrationInstance[] = []
  private _migrations?: {
    initialization: MigrationInstance[]
    upgrades: MigrationInstance[]
  }

  static migrations?: {
    version: string
    initialization?: MigrationClass
    upgrades?: MigrationClass[]
  }

  protected model<T extends ModelClass>(model_class: T): InstanceType<T> {
    const model = new model_class(this)
    this.model_class_registry.push(model_class)
    this.model_registry.push(model)
    return model as InstanceType<T>
  }

  public get driver() {
    // if (this.status !== 'initialized') throw new Error(`Cannot access driver. Torm is ${this.status}`)
    if (this._driver) return this._driver
    throw new Error(`Unexpected state. Torm has status '${this.status}', but driver is not initialized.`)
  }

  public get migrations() {
    if (this._migrations === undefined) throw new Error(`Torm must be initialized before performing migrations`)
    return this._migrations
  }

  protected abstract schemas_class: typeof SchemasModel
  public abstract schemas: SchemasModel
  public abstract close(): void

  public constructor() {
  }

  protected _init(driver: D, options?: InitOptions) {
    const thisConstructor = this.constructor as typeof TormBase<Driver>
    const application_version = thisConstructor.migrations?.version
    this._driver = driver

    this._migrations = {

      initialization: [thisConstructor.migrations?.initialization]
        .concat(this.model_class_registry
          .map(model_class => model_class.migrations?.initialization)
          .flat())
        .filter(migration_class => migration_class !== undefined)
        .map(migration_class => new migration_class!(this)),

      upgrades: (thisConstructor.migrations?.upgrades ?? [])
      .concat(this.model_class_registry
        .flatMap(model_class => model_class.migrations?.upgrades ?? []))
      .map(migration_class => new migration_class(this))
    }

    const { auto_migrate = true } = options ?? {}


    this.schemas.prepare_queries(driver)

    if (Migration.is_new(this)) Migration.initialize(this)

    if (application_version !== undefined) {
      if (auto_migrate) {
        while (Migration.outdated(this)) {
          this.status = 'outdated'
          Migration.upgrade(this)
        }
      }
      if (Migration.outdated(this)) {
        this.status = 'outdated'
      } else {
        for (const model of this.model_registry) {
          model.prepare_queries()
        }
        this.schemas.unsafe_version_set(application_version)
        this.status = 'initialized'
      }
    }
  }
}


export { TormBase }
export type { SchemasModel, InitOptions }
