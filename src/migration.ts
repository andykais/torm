import { ModelBase } from './model.ts'
import type { Driver } from './util.ts'

type Version = string

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
}

export { MigrationBase }
export type { MigrationClass }
