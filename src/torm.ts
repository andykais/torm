import type { Driver } from './util.ts'
import type { ModelClass, ModelInstance } from './model.ts'
import { ModelBase } from './model.ts'
import { MigrationsManager, MigrationRegistry } from './migration.ts';

interface InitOptions {
  auto_migrate?: boolean
}

interface TableRow {
  table_name: string
  table_schema: string
}
abstract class SchemasModel extends ModelBase {
  /** @internal */
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


export interface TormOptions {
  migrations?: MigrationRegistry
}

/** @internal */
export interface TormOptionsInternal extends TormOptions {
  migrations_internal: MigrationRegistry
}

abstract class TormBase<D extends Driver> {
  private status: 'uninitialized' | 'outdated' | 'initialized' = 'uninitialized'
  private _driver: D | null = null
  private migrations_manager: MigrationsManager
  private model_class_registry: ModelClass[] = []
  private model_registry: ModelInstance[] = []


  // NOTE this is currently a weird setup.
  // Torm::migrations is by default statically defined on Torm. That means multiple classes end up sharing the same state
  // setting it on your class like this solves that, but its not intuitive.
  // a decent solution here is to make this undefined by default. So migrations become an explicit thing you set up and manage
  static migrations: MigrationRegistry = new MigrationRegistry()

  protected model<T extends ModelClass>(model_class: T): InstanceType<T> {
    const model = new model_class(this)
    this.model_class_registry.push(model_class)
    this.model_registry.push(model)
    return model as InstanceType<T>
  }

  public get driver(): D {
    // if (this.status !== 'initialized') throw new Error(`Cannot access driver. Torm is ${this.status}`)
    if (this._driver) return this._driver
    throw new Error(`Unexpected state. Torm has status '${this.status}', but driver is not initialized.`)
  }

  public get migrations(): MigrationsManager {
    if (this.migrations_manager) return this.migrations_manager
    throw new Error(`MigrationsManager cannot be directly accessed until torm is initialized`)
  }

  protected abstract schemas_class: typeof SchemasModel
  public abstract schemas: SchemasModel
  public abstract close_driver(): void

  public close() {
    if (this.status === 'uninitialized') return
    this.close_driver()
  }

  public constructor(options: TormOptionsInternal) {
    // Torm::init can be called multiple times
    const migration_registry = options.migrations ?? new MigrationRegistry()
    this.migrations_manager = new MigrationsManager(this, migration_registry, options.migrations_internal)
  }

  protected _init(driver: D, options?: InitOptions) {
    const thisConstructor = this.constructor as typeof TormBase<Driver>

    this._driver = driver

    const { auto_migrate = true } = options ?? {}


    this.schemas.prepare_queries(driver)

    const application_version = this.migrations_manager.application_version()

    if (application_version !== undefined) {
      this.migrations_manager.validate()
      if (this.migrations_manager.is_database_initialized()) {
        this.migrations_manager.initialize_database()
      }

      if (auto_migrate) {
        while (this.migrations_manager.is_database_outdated()) {
          this.status = 'outdated'
          this.migrations_manager.upgrade_database()
        }
        this.initialize_models()
      }
      if (this.migrations_manager.is_database_outdated()) {
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
