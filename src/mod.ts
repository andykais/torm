import type { Database as SqliteNative } from '../../sqlite-native/src/database.ts'
import { Model } from './model.ts'

type Driver =
  | SqliteNative

type ModelClass<S, Q> = typeof Model<S, Q>
type InstantiatedModel<M extends ModelClass<S, Q>, S = any, Q = any> = Model<S, Q>

class Torm<M extends Record<string, ModelClass<any, any>>> {
  models: { [K in keyof M]: InstantiatedModel<M[K]> }
  public constructor(private driver: Driver, models: M) {
    const instantiated_models: Record<string, Model<any, any>> = {}
    for (const model_name of Object.keys(models)) {
      instantiated_models[model_name] = models[model_name]
    }
    this.models = instantiated_models as any
  }
}

function torm<M extends Record<string, ModelClass<any, any>>>(driver: Driver, models: M) {
  return new Torm(driver, models)
}

export { torm }
