import { semver } from './dependencies.ts'
import { ModelBase } from './model.ts'
import type { Driver } from './util.ts'
import type { TormBase } from './torm.ts'

type Version = string
interface MigrationRegistry {
  initialization?: MigrationClass
  upgrades?: MigrationClass[]
}

interface MigrationClass {
  new(torm: TormBase<Driver>): MigrationInstance
}

interface MigrationInstance extends ModelBase {
  version: Version
  call: (driver?: Driver) => void
}

abstract class MigrationBase extends ModelBase implements MigrationInstance {
  public abstract version: Version
  public abstract call(driver?: Driver): void

  private static application_version(torm: TormBase<Driver>) {
    const torm_class = torm.constructor as typeof TormBase<Driver>
    return torm_class.migrations?.version
  }

  public static is_new(torm: TormBase<Driver>) {
    return torm.schemas.table('__torm_metadata__') === undefined
  }

  public static initialize(torm: TormBase<Driver>) {
    const application_version = MigrationBase.application_version(torm)
    const schemas_class = torm.schemas.constructor as typeof ModelBase
    torm.schemas.prepare_queries(torm.driver)
    const schemas_init = new schemas_class.migrations!.initialization!(torm)
    schemas_init.prepare_queries(torm.driver)
    schemas_init.call(torm.driver)

    for (const migration of torm.migrations.initialization) {
      migration.prepare_queries()
      migration.call()
    }
    if (application_version !== undefined) torm.schemas.unsafe_version_set(application_version)
  }

  public static outdated(torm: TormBase<Driver>) {
    const torm_class = torm.constructor as typeof TormBase<Driver>
    const application_version = torm_class.migrations?.version
    if (application_version === undefined) return false
    else {
      const current_version = torm.schemas.version()
      return semver.lt(current_version, application_version)
    }
  }

  public static upgrade(torm: TormBase<Driver>) {
    const application_version = MigrationBase.application_version(torm)
    if (application_version === undefined) throw new Error('Cannot upgrade database. Declared version is undefined.')
    const current_version = torm.schemas.version()
    const migration_map: Record<Version, MigrationInstance[]> = {}
    for (const migration of torm.migrations.upgrades) {
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
}

export { MigrationBase }
export type { Version, MigrationClass, MigrationInstance, MigrationRegistry }
