export { assertEquals as assert_equals, assertRejects as assert_rejects, assertThrows as assert_throws } from "https://deno.land/std@0.155.0/testing/asserts.ts";
export { expectType as expect_type } from "npm:ts-expect"
import * as colors from 'jsr:@std/fmt@0.225.4/colors'

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
  create_fixture_path(path: string) {
    return `${this.fixture_folder}/${path}`
  }

  async remove(path: string) {
    await Deno.remove(path, { recursive: true })
  }
}

class Debugger {
  static #decoder = new TextDecoder()

  // simple global debug logger that includes the current function name
  static log = (...args: any) => {
    let trace = 1
    if (typeof args[0] === 'object' && Object.keys(args[0]).length === 1 && typeof args[0].trace === 'number') {
      trace = args[0].trace
      args.shift()
    }
    // TODO neat idea: read the source code line to show what is being printed
    const stacktrace = new Error().stack!.split('\n')
    const stacktrace_console_debug_line = stacktrace[2]
    const stacktrace_console_debug_location = stacktrace_console_debug_line.substring(
      stacktrace_console_debug_line.indexOf('file://') + 7,
      stacktrace_console_debug_line.lastIndexOf(':'),
    )
    const stacktrace_console_debug_filepath = stacktrace_console_debug_location.substring(
      0,
      stacktrace_console_debug_location.lastIndexOf(':')
    )
    const stacktrace_console_debug_line_number = parseInt(stacktrace_console_debug_location.substr(
      stacktrace_console_debug_location.lastIndexOf(':') + 1
    ))
    const file_contents = this.#decoder.decode(Deno.readFileSync(stacktrace_console_debug_filepath))
    const stacktrace_console_debug_source_code = file_contents.split('\n')[stacktrace_console_debug_line_number - 1].trim()

    for (let trace_index = trace; trace_index > 0; trace_index--) {
      let code_line = stacktrace[trace_index + 1].trim()
      // trim the path to be relative
      code_line = code_line.replace('file://' + Deno.cwd(), '.')
      const formatted_code_line = `${code_line}`
      console.log(colors.gray(formatted_code_line))
    }
    console.log('   ' + colors.gray(stacktrace_console_debug_source_code))
    console.log(...args)
    console.log()
  }

  static #console_debug: Console['debug'] | undefined

  static attach_console_debug() {
    if (this.#console_debug) throw new Error('console.debug is already attached')
    this.#console_debug = console.debug
    console.debug = this.log
  }

  static detatch_console_debug() {
    if (!this.#console_debug) throw new Error('console.debug is not attached')
    console.debug = this.#console_debug
    this.#console_debug = undefined
  }
}

function test(test_name: string, fn: (test_context: TestContext) => any, only = false) {
  const test_context = new TestContext(test_name)

  const test_fn = async () => {
    // setup
    await Deno.mkdir(test_context.fixture_folder, { recursive: true })
    await Deno.remove(test_context.fixture_folder, { recursive: true })
    await Deno.mkdir(test_context.fixture_folder, { recursive: true })
    Debugger.attach_console_debug()

    const result = await fn(test_context)

    // teardown
    Debugger.detatch_console_debug()
    return result
  }
  Deno.test({
    name: test_name,
    fn: test_fn,
    only
  })
}
test.only = (name: string, fn: (test_context: TestContext) => any) => { test(name, fn, true) }

export { test }
