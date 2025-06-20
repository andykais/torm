import type { Driver } from './util.ts'
import type { ModelClass, ModelInstance } from './model.ts'
import { ModelBase } from './model.ts'
import { MigrationsManager, MigrationRegistry, type Version, type MigrationOperation } from './migration.ts';

interface InitOptions {
  /** Options controlling migration behavior */
  migrate?: {
    /** Whether or not torm should automatically migrate up to the latest seed migration version */
    auto?: boolean
    /** Whether or not a backup should be made of the database before each migration */
    backup?: boolean
  }
  /** The location of the backups */
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
  abstract unsafe_version_set(version: Version): void

  /**
    * Returns the current migration version of the database
    */
  abstract version(): Version
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


export interface InitInfo {
  /** The version the database is currently at */
  current_version: Version

  /** Any operations performed to upgrade the database. This field only populates when {@link InitOptions.migration.auto} is true */
  migration_operations: MigrationOperation[]
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

  protected _init(driver: D, options?: InitOptions): InitInfo {
    const thisConstructor = this.constructor as typeof TormBase<Driver>

    this._driver = driver

    const auto_migrate = options?.migrate?.auto ?? true
    const backup_before_migrate = options?.migrate?.backup ?? false

    this.schemas.prepare_queries(driver)

    const application_version = this.migrations_manager.application_version()
    const migration_operations: MigrationOperation[] = []

    if (application_version !== undefined) {
      this.migrations_manager.validate()
      if (this.migrations_manager.is_database_initialized()) {
        this.migrations_manager.initialize_database()
      }

      if (auto_migrate) {
        while (this.migrations_manager.is_database_outdated()) {
          this.status = 'outdated'
          const current_version = this.schemas.version()
          const migration_operation: MigrationOperation = {
            start_version: current_version,
            backup: false,
            next_version: -1,
          }
          if (backup_before_migrate) {
            if (!options?.backups?.folder) {
              throw new Error(`backups_folder must be defined in order to use automatic backups`)
            }
            migration_operation.backup = true
            this.backup(options.backups.folder, `migration_backup_v${current_version}`)
          }
          const next_version = this.migrations_manager.upgrade_database()
          migration_operation.next_version = next_version
          migration_operations.push(migration_operation)
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

    return {
      current_version: this.schemas.version(),
      migration_operations,
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
