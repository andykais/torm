class StaticRegistry<T, R = T> {
  public registry: R[] = []

  public constructor() {}

  public register() {
    return (item: T, context: ClassDecoratorContext) => {
      this.update_registry(this.registry, item)
    }
  }

  protected update_registry(registry: R[], new_item: T) {
    // because T and R can be different types, its best not to assume a default implementation
    throw new Error('unimplemented')
  }
}

type TypeOf<T> = T extends {new(...args: any[]): infer ClassType }
  ? ClassType
  : never


@((a, b) => {})
class Foo {
}
export { StaticRegistry}
