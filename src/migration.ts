import { ModelBase } from './model.ts'
import { StaticRegistry } from './static_registry_decorator.ts'
import { MigrationValidationError, MigrationError } from './errors.ts'
import type { Driver } from './util.ts'
import type { TormBase } from './torm.ts'


type Version = number


class MigrationRegistry extends StaticRegistry<MigrationClass> {
  #validation_registry: MigrationInstance[] = []

  /** @internal */
  public override update_registry(registry: MigrationClass[], migration_class: MigrationClass) {
    const migration_instance = new migration_class(undefined)
    // TODO add validation
    const updated_registry = [...this.#validation_registry, migration_instance]
    MigrationRegistry.validate_registry(updated_registry)
    this.#validation_registry.push(migration_instance)
    registry.push(migration_class)
  }

  private static validate_registry(migration_registry: MigrationInstance[]) {
    let prev_migration: MigrationInstance | undefined

    for (const migration of migration_registry) {
      // important note: lots of history here https://github.com/tc39/proposal-decorators/issues/329
      // summarized though, tc39 always eval'd class decorators before static props were assigned
      // typescript briefly did it differently, letting static props be accessed by class decorators
      // typescript is now better aligned with tc39, and this is busted.
      // Migration::version needs to be moved to an instantiated property and the whole class needs to be instantiated earlier
      if (typeof migration.version !== 'number') {
        throw new MigrationValidationError(`Migrations must define a static numeric version property. Migration\n${migration.constructor.name}\ndefined ${migration.version}`)
      }

      if (prev_migration) {
        const prev_version = prev_migration.version
        const current_version = migration.version

        if (prev_migration.is_seed_migration()) {
          if (migration.is_seed_migration()) {
            if (prev_version !== current_version) {
              const seed_migrations = migration_registry.map(m => `${m.constructor.name}: "${m.version}"`).join(',')
              throw new MigrationValidationError(`All seed migrations must keep the same version. Seed migrations: [${seed_migrations}]`)
            }
          } else {
            if (prev_version < current_version) {
              throw new MigrationValidationError(`Seed migrations have version ${prev_migration.version}. Upgrade migrations versions must not exceed the seed migration version. ${migration} fails this check.`)
            }
          }

        } else {
          if (prev_version > current_version) {
            throw new MigrationValidationError(`Migrations must be registered in order.\n${migration}\nversion is less than\n${prev_migration}`)
          }
        }
      }
      prev_migration = migration
    }
  }

  get_migrations(torm: TormBase<Driver>): MigrationsSorted {
    let application_version: Version | undefined
    const initialization: MigrationInstance[] = []
    const upgrades: MigrationInstance[] = []

    for (const migration_class of this.registry) {
      const migration = new migration_class(torm)
      if (migration.is_seed_migration()) {
        initialization.push(migration)
        application_version = migration.version
      } else {
        upgrades.push(migration)
      }
    }

    if (!application_version) {
      throw new Error('no seed migrations')
    }

    return {
      application_version,
      initialization,
      upgrades,
    }
  }
}


interface MigrationsSorted {
  application_version: Version
  initialization: MigrationInstance[]
  upgrades: MigrationInstance[]
}


class MigrationsManager {
  #application_version: Version
  #torm: TormBase<Driver>
  #migrations: MigrationsSorted
  #migrations_internal: MigrationsSorted
  public registry: MigrationClass[]

  public constructor(
    torm: TormBase<Driver>,
    migration_registry: MigrationRegistry,
    migration_registry_internal: MigrationRegistry,
  ) {
    this.registry = migration_registry.registry
    this.#migrations_internal = migration_registry_internal.get_migrations(torm)
    this.#migrations = migration_registry.get_migrations(torm)
    this.#torm = torm
    this.#application_version = this.#migrations.application_version
  }

  public application_version(): Version {
    return this.#application_version
  }

  public is_database_outdated(): boolean {
    if (this.#application_version === undefined) return false
    else {
      const current_version = this.#torm.schemas.version()
      const application_version = this.#application_version
      return current_version < application_version
    }
  }

  public is_database_initialized(): boolean {
    return this.#torm.schemas.table('__torm_metadata__') === undefined
  }

  public upgrade_database() {
    if (this.#application_version === undefined) throw new Error('Cannot upgrade database. Declared version is undefined.')

    const current_version = this.#torm.schemas.version()
    const application_version = this.#application_version
    const migration_map = new Map<Version, MigrationInstance[]>
    for (const migration of this.#migrations.upgrades) {
      const version_migrations = migration_map.get(migration.version) ?? []
      migration_map.set(migration.version, version_migrations)
      version_migrations.push(migration)
    }
    const upgrade_versions = Array.from(migration_map.keys())
    upgrade_versions.sort((a, b) => a - b)
    if (upgrade_versions.some(version => version > application_version)) {
      throw new Error(`Declared migrations include version ${upgrade_versions} that exceeds declared current torm version ${this.#application_version}`)
    }
    const next_version = upgrade_versions.find(version => version > current_version)
    if (next_version === undefined) throw new Error('No new version exists. Database is up to date')
    // TODO put a transaction around this block
    for (const migration of migration_map.get(next_version)!) {
      migration.prepare_queries()
      migration.call()
    }
    this.#torm.schemas.unsafe_version_set(next_version)
  }

  public validate() {
    if (this.#application_version === undefined) throw new Error('Misconfigured migration: expected a configured application version, found undefined')

    const application_version = this.#application_version

    for (const migration of this.#migrations.initialization) {
      if (migration.version !== this.#application_version) {
        throw new MigrationValidationError(`Misconfigured migration: ${migration.constructor.name} initialization migration version ${migration.version} does not match defined application version ${this.#application_version}`)
      }
    }

    if (this.#migrations.upgrades.length) {
      const last_migration = this.#migrations.upgrades.at(-1)!
      const last_migration_version = last_migration.version
      if (last_migration_version !== application_version) {
        throw new MigrationValidationError(`The newest upgrade migration version (${last_migration.version}) must match the current application version (${this.#application_version})`)
      }
    }

    if (this.#migrations.upgrades.length > 0) {
      let at_least_one_current_migration = false
      for (const migration of this.#migrations.upgrades) {
        const migration_version = migration.version
        if (migration_version === application_version) {
          at_least_one_current_migration = true
        } else if (migration_version > application_version) {
          throw new MigrationValidationError(`Misconfigured migration: ${migration.constructor.name} upgrade migration version ${migration.version} is greater than defined application version ${this.#application_version}`)
        }
      }
      if (at_least_one_current_migration === false) throw new MigrationValidationError(`Misconfigured migration: at least one upgrade migration matching the defined application version ${this.#application_version} must exist`)
    }
  }

  public initialize_database() {
    this.#torm.schemas.prepare_queries(this.#torm.driver)

    for (const migration of this.#migrations_internal.initialization) {
      migration.prepare_queries()
      migration.call(this.#torm.driver)
    }

    for (const migration of this.#migrations.initialization) {
      migration.prepare_queries()
      migration.call(this.#torm.driver)
    }
    if (this.#application_version !== undefined) this.#torm.schemas.unsafe_version_set(this.#application_version)
  }

}

interface MigrationClass {
  // version: Version
  new(torm: TormBase<Driver> | undefined): MigrationInstance
}

interface MigrationInstance extends ModelBase {
  version: Version
  call: (driver?: Driver) => void
  is_seed_migration(): boolean
}

abstract class MigrationBase extends ModelBase implements MigrationInstance {
  public abstract version: Version
  public abstract call(driver?: Driver): void

  public is_seed_migration(): boolean {
    return false
  }
}

abstract class SeedMigrationBase extends MigrationBase {
  public override is_seed_migration(): boolean {
    return true
  }
}

export { MigrationsManager, MigrationBase, SeedMigrationBase, MigrationError, MigrationValidationError, MigrationRegistry  }
export type { Version, MigrationClass, MigrationInstance }
