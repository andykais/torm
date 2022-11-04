import { ModelBase } from './model.ts'
import { TormBase } from './torm.ts'
import type { Driver } from './util.ts'

type Version = string
interface MigrationRegistry {
  initialization?: MigrationClass
  upgrades?: MigrationClass[]
}

interface MigrationClass {
  new(): MigrationInstance
}

interface MigrationInstance extends ModelBase {
  version: Version
  call: () => void
}

abstract class MigrationBase extends ModelBase implements MigrationInstance {
  public abstract version: Version
  public abstract call(): void

  static outdated(torm: TormBase<Driver>) {
    const torm_class = torm.constructor as typeof TormBase<Driver>
    const application_version = torm_class.migrations?.version
    if (application_version === undefined) return false

  }
}

export { MigrationBase }
export type { Version, MigrationClass, MigrationRegistry }
