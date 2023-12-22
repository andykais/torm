interface StaticRegistryOptions<T> {
  validate_registry: (registry: T[]) => void
}

class StaticRegistry<T> {
  private injected: boolean = false

  public registry: T[] = []

  public constructor(private options?: StaticRegistryOptions<T>) {}

  public register() {
    if (!this.injected) {
      throw new Error('Expected class injection before calling registry')
    }

    return (item: T) => {
      const registry_new = [...this.registry, item]
      if (this.options?.validate_registry) {
        this.options.validate_registry(registry_new)
      }
      this.registry = registry_new
    }
  }

  /** internal */
  public copy(injected: boolean): StaticRegistry<T> {
    const static_registry = new StaticRegistry<T>(this.options)
    static_registry.injected = injected
    return static_registry
  }

  public static wrap<K extends object>() {
    return (klass: K) => {
      const static_registry_props: string[] = []
      for (const [attribute_key, attribute_val] of Object.entries(klass)) {
        if (attribute_val instanceof StaticRegistry) {
          static_registry_props.push(attribute_key)
        }
      }

      const proxy_handler = {
        get(target: K, prop: string, receiver: any) {
          if (static_registry_props.includes(prop)) {
            const registry_old = Reflect.get(target, prop, receiver) as StaticRegistry<any>
            const registry_new = registry_old.copy(true)
            receiver[prop] = registry_new
            return registry_new
          }
          return Reflect.get(target, prop, receiver)
        }
      }
      return new Proxy(klass, proxy_handler) as K
    }
  }
}


export { StaticRegistry}
