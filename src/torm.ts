import type { Driver } from './util.ts'
import type { ModelClass, ModelInstance } from './model.ts'
import { ModelBase } from './model.ts'
import { MigrationsManager, MigrationRegistry } from './migration.ts';
import path from "node:path";

interface InitOptions {
  migrate?: {
    auto?: boolean
    backup?: boolean
  }
  backups?: {
    folder: string
  }
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
  protected options: TormOptionsInternal

  /**
    * Register a model in torm. Any queries registered under that model will be prepared during initialization
    */
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
    this.options = options
  }

  protected _init(driver: D, options?: InitOptions) {
    const thisConstructor = this.constructor as typeof TormBase<Driver>

    this._driver = driver

    const auto_migrate = options?.migrate?.auto ?? true
    const backup_before_migrate = options?.migrate?.backup ?? false

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
          if (backup_before_migrate) {
            if (!options?.backups?.folder) {
              throw new Error(`backups_folder must be defined in order to use automatic backups`)
            }
            const current_version = this.schemas.version()
            this.backup(options.backups.folder, `migration_from_${current_version}`)
          }
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

  public abstract backup(folder: string, name: string): void

  private initialize_models = () => {
    for (const model of this.model_registry) {
      model.prepare_queries()
    }
  }
}


export { TormBase }
export type { SchemasModel, InitOptions }
