export { assertEquals as assert_equals } from "https://deno.land/std@0.155.0/testing/asserts.ts";
export { expectType as expect_type } from "npm:ts-expect"

const resources = {
  books_db_1_0_0: 'test/resources/migrations_1.0.0.db',
}
class TestContext {
  test_name: string
  resources = resources

  constructor(test_name: string) {
    this.test_name = test_name
  }

  get fixture_folder() {
    return `test/fixtures/${this.test_name}`
  }
  fixture_path(path: string) {
    return `${this.fixture_folder}/${path}`
  }

  async remove(path: string) {
    await Deno.remove(path, { recursive: true })
  }
}

function test(test_name: string, fn: (test_context: TestContext) => any, only = false) {
  const test_context = new TestContext(test_name)
  const before_test = async () => {
    await Deno.mkdir(test_context.fixture_folder, { recursive: true })
    await Deno.remove(test_context.fixture_folder, { recursive: true })
    await Deno.mkdir(test_context.fixture_folder, { recursive: true })

    const result = await fn(test_context)
    return result
  }
  Deno.test({
    name: test_name,
    fn: before_test,
    only
  })
}
test.only = (name: string, fn: (test_context: TestContext) => any) => { test(name, fn, true) }

export { test }
