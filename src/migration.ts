import { semver } from './deps.ts'
import { ModelBase } from './model.ts'
import { StaticRegistry } from './static_registry_decorator.ts'
import type { Driver } from './util.ts'
import type { TormBase } from './torm.ts'


type Version = string
interface MigrationRegistry {
  initialization?: MigrationClass
  upgrades?: MigrationClass[]
}


class MigrationRegistry extends StaticRegistry<MigrationClass> {
  #validation_registry: MigrationInstance[] = []

  protected update_registry(registry: MigrationClass[], migration_class: MigrationClass) {
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
      if (!semver.valid(migration.version)) {
        throw new MigrationValidationError(`Migrations must define a static version property. Migration\n${migration}\ndefined ${migration.version}`)
      }

      if (prev_migration) {
        if (prev_migration.is_seed_migration()) {
          if (migration.is_seed_migration()) {
            if (!semver.eq(prev_migration.version, migration.version)) {
              throw new MigrationValidationError(`All seed migrations must keep the same version.`)
            }
          } else {
            if (semver.lt(prev_migration.version, migration.version)) {
              throw new MigrationValidationError(`Seed migrations have version ${prev_migration.version}. Upgrade migrations versions must not exceed the seed migration version. ${migration} fails this check.`)
            }
          }

        } else {
          if (!semver.lte(prev_migration.version, migration.version)) {
            throw new MigrationValidationError(`Migrations must be registered in order.\n${migration}\nversion is less than\n${prev_migration}`)
          }
        }
      }
      prev_migration = migration
    }
  }

}




class MigrationsManager {
  #application_version: Version
  #torm: TormBase<Driver>
  #migrations = {
    initialization: [] as MigrationInstance[],
    upgrades: [] as MigrationInstance[],
  }
  public registry: MigrationClass[]

  public constructor(private torm: TormBase<Driver>) {
    const thisConstructor = torm.constructor as typeof TormBase<Driver>
    this.registry = thisConstructor.migrations.registry

    let application_version: Version | undefined
    // TODO so this is a problem. We have to instantiate a Migration (Model) class to find out the Migration::version because static properties cannot be accessed within the decorator
    // the problem is instantiating and storing migration classes statically on a Torm class means each instantiated torm database is going to use the same migration class instance
    // I _think_ this means the right approach is storing uninstantiated classes statically and instantiating each time we instantiate Torm
    // I did like the idea that my migrations would error out at registration time, but perhaps thats overkill or even not very useful since we cant catch those exceptions very well
    for (const migration_class of this.registry) {
      const migration = new migration_class(torm)
      if (this.is_seed_migration(migration)) {
        this.#migrations.initialization.push(migration)
        application_version = migration.version
      } else {
        this.#migrations.upgrades.push(migration)
      }
    }

    if (!application_version) {
      throw new Error('no seed migrations')
    }
    this.#torm = torm
    this.#application_version = application_version
  }

  public application_version(): Version {
    return this.#application_version
  }

  public is_database_outdated(): boolean {
    if (this.#application_version === undefined) return false
    else {
      const current_version = this.#torm.schemas.version()
      return semver.lt(current_version, this.#application_version)
    }
  }

  public is_database_initialized(): boolean {
    return this.torm.schemas.table('__torm_metadata__') === undefined
  }

  public upgrade_database() {
    if (this.#application_version === undefined) throw new Error('Cannot upgrade database. Declared version is undefined.')
    const current_version = this.#torm.schemas.version()
    const migration_map: Record<Version, MigrationInstance[]> = {}
    for (const migration of this.#migrations.upgrades) {
      migration_map[migration.version] ??= []
      migration_map[migration.version].push(migration)
    }
    const upgrade_versions = Object.keys(migration_map)
    upgrade_versions.sort(semver.compare)
    if (upgrade_versions.some(v => semver.gt(v, this.#application_version))) {
      throw new Error(`Declared migrations include version ${upgrade_versions} that exceeds declared current torm version ${this.#application_version}`)
    }
    const next_version = upgrade_versions.find(v => semver.gt(v, current_version))
    if (next_version === undefined) throw new Error('No new version exists. Database is up to date')
    // TODO put a transaction around this block
    for (const migration of migration_map[next_version]) {
      migration.prepare_queries()
      migration.call()
    }
    this.#torm.schemas.unsafe_version_set(next_version)
  }

  private is_seed_migration(migration: object): boolean {
    if (migration instanceof SeedMigrationBase) return true
    else return false
  }

  public validate() {
    if (this.#application_version === undefined) throw new Error('Misconfigured migration: expected a configured application version, found undefined')
    for (const migration of this.#migrations.initialization) {
      if (migration.version !== this.#application_version) {
        throw new MigrationValidationError(`Misconfigured migration: ${migration.constructor.name} initialization migration version ${migration.version} does not match defined application version ${this.#application_version}`)
      }
    }

    if (this.#migrations.upgrades.length) {
      const last_migration = this.#migrations.upgrades.at(-1)!
      if (!semver.eq(last_migration.version, this.#application_version)) {
        throw new MigrationValidationError(`The last upgrade migration version must match the current application version`)
      }
    }

    if (this.#migrations.upgrades.length > 0) {
      let at_least_one_current_migration = false
      for (const migration of this.#migrations.upgrades) {
        if (semver.eq(migration.version, this.#application_version)) {
          at_least_one_current_migration = true
        } else if (semver.gt(migration.version, this.#application_version)) {
          throw new MigrationValidationError(`Misconfigured migration: ${migration.constructor.name} upgrade migration version ${migration.version} is greater than defined application version ${this.#application_version}`)
        }
      }
      if (at_least_one_current_migration === false) throw new MigrationValidationError(`Misconfigured migration: at least one upgrade migration matching the defined application version ${this.#application_version} must exist`)
    }
  }

  public initialize_database() {
    const schemas_class = this.#torm.schemas.constructor as typeof ModelBase
    this.#torm.schemas.prepare_queries(this.#torm.driver)
    const schemas_init = new schemas_class.migrations!.initialization!(this.#torm)
    schemas_init.prepare_queries(this.#torm.driver)
    schemas_init.call(this.#torm.driver)

    for (const migration of this.#migrations.initialization) {
      migration.prepare_queries()
      migration.call()
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

class MigrationError extends Error {}
class MigrationValidationError extends MigrationError {}

abstract class MigrationBase extends ModelBase implements MigrationInstance {
  public abstract version: string
  public abstract call(driver?: Driver): void

  public is_seed_migration(): boolean {
    if (this instanceof SeedMigrationBase) return true
    else return false
  }
}

abstract class SeedMigrationBase extends MigrationBase {}

export { MigrationsManager, MigrationBase, SeedMigrationBase, MigrationError, MigrationValidationError, MigrationRegistry  }
export type { Version, MigrationClass, MigrationInstance }
