import type { Constructor, Driver } from './util.ts'
import type { ModelBase } from './model.ts'

type ModelDefinition = {
  [key: string]: Constructor
}
type ModelInstances<T extends ModelDefinition> = {
  [K in keyof T]: InstanceType<T[K]>
}
class Torm<T extends ModelDefinition> {
  public models: ModelInstances<T>

  public constructor(driver: Driver, model_definitions: T) {
    const models = {} as any
    for (const [name, model_class] of Object.entries(model_definitions)) {
      models[name] = new model_class(driver)
    }
    this.models = models
  }
}

async function torm<T extends ModelDefinition>(driver: Driver, model_definitions: T): Promise<ModelInstances<T>> {
  const models = {} as any
  for (const [name, model_class] of Object.entries(model_definitions)) {
    models[name] = new model_class(driver)
  }
  return models
}

export { Torm, torm }
