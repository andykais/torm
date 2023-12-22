import type { Driver } from './util.ts'
import type { ModelClass, ModelInstance } from './model.ts'
import type { MigrationClass, MigrationInstance } from './migration.ts'
import { ModelBase } from './model.ts'
import { MigrationBase } from './migration.ts';
import { StaticRegistry } from './static_registry_decorator.ts'

interface InitOptions {
  auto_migrate?: boolean
}

interface TableRow {
  table_name: string
  table_schema: string
}
abstract class SchemasModel extends ModelBase {
  abstract unsafe_version_set(version: string): void
  /**
    * Returns the current migration version of the database
    */
  abstract version(): string
  /**
    * Returns table information a particular table
    */
  abstract table(table_name: string): TableRow | undefined
  /**
    * Returns a predictable array of information on the database schemas
    */
  abstract tables(): TableRow[]
}


@StaticRegistry.wrap()
abstract class TormBase<D extends Driver> {
  private status: 'uninitialized' | 'outdated' | 'initialized' = 'uninitialized'
  private _driver: D | null = null
  private model_class_registry: ModelClass[] = []
  private model_registry: ModelInstance[] = []


  static migrations = new StaticRegistry<MigrationClass>({
    validate_registry: MigrationBase.validate_registry
  })

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

  protected abstract schemas_class: typeof SchemasModel
  public abstract schemas: SchemasModel
  public abstract close(): void

  public constructor() {}

  protected _init(driver: D, options?: InitOptions) {
    const thisConstructor = this.constructor as typeof TormBase<Driver>

    this._driver = driver

    const { auto_migrate = true } = options ?? {}


    this.schemas.prepare_queries(driver)

    const application_version = MigrationBase.application_version(this)

    if (application_version !== undefined) {
      MigrationBase.validate(this)
      if (MigrationBase.is_new(this)) MigrationBase.initialize(this)

      if (auto_migrate) {
        while (MigrationBase.outdated(this)) {
          this.status = 'outdated'
          MigrationBase.upgrade(this)
        }
        this.initialize_models()
      }
      if (MigrationBase.outdated(this)) {
        this.status = 'outdated'
      } else {
        this.initialize_models()
        this.schemas.unsafe_version_set(application_version)
        this.status = 'initialized'
      }
    } else {
      this.initialize_models()
    }
  }

  private initialize_models = () => {
    for (const model of this.model_registry) {
      model.prepare_queries()
    }
  }
}


export { TormBase }
export type { SchemasModel, InitOptions }
