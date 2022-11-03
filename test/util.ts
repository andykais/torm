export { assertEquals as assert_equals } from "https://deno.land/std@0.155.0/testing/asserts.ts";
export { expectType as expect_type } from "https://cdn.skypack.dev/ts-expect?dts"

function test(name: string, fn: () => any, only = false) {
  Deno.test({
    name,
    fn,
    only
  })
}
test.only = (name: string, fn: () => any) => { test(name, fn, true) }

export { test }
