import type { Constructor, Driver } from './util.ts'
import type { ModelClass, ModelInstance } from './model.ts'


abstract class TormBase<D extends Driver> {
  private _driver: D | null = null
  private model_registry: ModelInstance[] = []

  protected model<T extends ModelClass>(model_class: T): InstanceType<T> {
    const model = new model_class()
    this.model_registry.push(model)
    return model as InstanceType<T>
  }

  public get driver() {
    if (this._driver) return this._driver
    else throw new Error('A driver cannot be instantiated until init() is called')
  }

  public on_create() {}

  public init(driver: D) {
    this._driver = driver
    this.on_create()
    for (const model of this.model_registry) {
      model.prepare_queries(driver)
    }
  }
}


// old impl
// type ModelDefinition = {
//   [key: string]: Constructor
// }
// type ModelInstances<T extends ModelDefinition> = {
//   [K in keyof T]: InstanceType<T[K]>
// }
// async function torm<T extends ModelDefinition>(driver: Driver, model_definitions: T): Promise<ModelInstances<T>> {
//   const models = {} as any
//   for (const [name, model_class] of Object.entries(model_definitions)) {
//     models[name] = new model_class(driver)
//   }
//   return models
// }

export { TormBase }
