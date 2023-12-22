import { semver } from './deps.ts'
import { ModelBase } from './model.ts'
import type { Driver } from './util.ts'
import type { TormBase } from './torm.ts'

type Version = string
interface MigrationRegistry {
  initialization?: MigrationClass
  upgrades?: MigrationClass[]
}

interface MigrationClass {
  version: Version
  new(torm: TormBase<Driver>): MigrationInstance
}

interface MigrationInstance extends ModelBase {
  version: Version
  call: (driver?: Driver) => void
}

class MigrationError extends Error {}
class MigrationValidationError extends MigrationError {}

abstract class MigrationBase extends ModelBase implements MigrationInstance {
  public abstract call(driver?: Driver): void

  public get version() {
    return (this.constructor as MigrationClass).version
  }

  public static application_version(torm: TormBase<Driver>) {
    return this.parse_migration_registry(torm).version
  }

  public static is_new(torm: TormBase<Driver>) {
    return torm.schemas.table('__torm_metadata__') === undefined
  }

  public static validate_registry(migration_registry: MigrationClass[]) {
    function is_seed(obj: any) {
      return obj.seed
    }

    let first_seed_migration: MigrationClass | undefined
    let prev_migration: MigrationClass | undefined

    for (const migration of migration_registry) {
      if (prev_migration) {
        if (is_seed(prev_migration)) {
          if (is_seed(migration)) {
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

  public static validate(torm: TormBase<Driver>) {
    const migrations = this.parse_migration_registry(torm)

    const application_version = MigrationBase.application_version(torm)
    if (application_version === undefined) throw new Error('Misconfigured migration: expected a configured application version, found undefined')
    for (const migration of migrations.initialization) {
      if (migration.version !== application_version) {
        throw new MigrationValidationError(`Misconfigured migration: ${migration.constructor.name} initialization migration version ${migration.version} does not match defined application version ${application_version}`)
      }
    }

    if (migrations.upgrades) {
      const last_migration = migrations.upgrades.at(-1)!
      if (!semver.eq(last_migration.version, application_version)) {
        throw new MigrationValidationError(`The last upgrade migration version must match the current application version`)
      }
    }

    if (migrations.upgrades.length > 0) {
      let at_least_one_current_migration = false
      for (const migration of migrations.upgrades) {
        if (semver.eq(migration.version, application_version)) {
          at_least_one_current_migration = true
        } else if (semver.gt(migration.version, application_version)) {
          throw new MigrationValidationError(`Misconfigured migration: ${migration.constructor.name} upgrade migration version ${migration.version} is greater than defined application version ${application_version}`)
        }
      }
      if (at_least_one_current_migration === false) throw new MigrationValidationError(`Misconfigured migration: at least one upgrade migration matching the defined application version ${application_version} must exist`)
    }
  }

  public static initialize(torm: TormBase<Driver>) {
    const migrations = this.parse_migration_registry(torm)

    const application_version = MigrationBase.application_version(torm)
    const schemas_class = torm.schemas.constructor as typeof ModelBase
    torm.schemas.prepare_queries(torm.driver)
    const schemas_init = new schemas_class.migrations!.initialization!(torm)
    schemas_init.prepare_queries(torm.driver)
    schemas_init.call(torm.driver)

    for (const migration of migrations.initialization) {
      migration.prepare_queries()
      migration.call()
    }
    if (application_version !== undefined) torm.schemas.unsafe_version_set(application_version)
  }

  public static outdated(torm: TormBase<Driver>) {
    const application_version = this.application_version(torm)
    if (application_version === undefined) return false
    else {
      const current_version = torm.schemas.version()
      return semver.lt(current_version, application_version)
    }
  }

  public static upgrade(torm: TormBase<Driver>) {
    const migrations = this.parse_migration_registry(torm)

    const application_version = MigrationBase.application_version(torm)
    if (application_version === undefined) throw new Error('Cannot upgrade database. Declared version is undefined.')
    const current_version = torm.schemas.version()
    const migration_map: Record<Version, MigrationInstance[]> = {}
    for (const migration of migrations.upgrades) {
      migration_map[migration.version] ??= []
      migration_map[migration.version].push(migration)
    }
    const upgrade_versions = Object.keys(migration_map)
    upgrade_versions.sort(semver.compare)
    if (upgrade_versions.some(v => semver.gt(v, application_version))) {
      throw new Error(`Declared migrations include version ${upgrade_versions} that exceeds declared current torm version ${application_version}`)
    }
    const next_version = upgrade_versions.find(v => semver.gt(v, current_version))
    if (next_version === undefined) throw new Error('No new version exists. Database is up to date')
    // TODO put a transaction around this block
    for (const migration of migration_map[next_version]) {
      migration.prepare_queries()
      migration.call()
    }
    torm.schemas.unsafe_version_set(next_version)
  }

  private static is_seed_migration(obj: object) {
    if ((obj as any).seed) return true
    else return false

    // TODO impl SeedMigration
    // if (migration === SeedMigration) return true
    // const prototype = Object.getPrototypeOf(migration)
    // if (prototype) return is_seed(prototype)
    // return false
  }

  private static parse_migration_registry(torm: TormBase<Driver>) {
    const thisConstructor = torm.constructor as typeof TormBase<Driver>
    const registry = thisConstructor.migrations.registry

    const initialization = registry
      .filter(migration_class => this.is_seed_migration(migration_class))
      .map(migration_class => new migration_class(torm))

    const upgrades = registry
      .filter(migration_class => !this.is_seed_migration(migration_class))
      .map(migration_class => new migration_class(torm))

    const application_version = initialization.at(0)?.version

    return {
      version: application_version,
      initialization,
      upgrades,
    }
  }
}

export { MigrationBase, MigrationError, MigrationValidationError }
export type { Version, MigrationClass, MigrationInstance, MigrationRegistry }
