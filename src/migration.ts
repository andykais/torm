import { ModelBase } from './model.ts'

interface MigrationClass {
  new(): MigrationInstance
}

interface MigrationInstance extends ModelBase {
  version: string
  call: () => void
}

abstract class MigrationBase extends ModelBase implements MigrationInstance {
  public abstract version: string
  public abstract call(): void
}

export { MigrationBase }
export type { MigrationClass }
