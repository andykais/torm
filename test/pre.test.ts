import * as path from '@std/path'
import { test, assert_equals } from './util.ts'

test('linter pretest', async () => {
  const deno_json = JSON.parse(await Deno.readTextFile(path.resolve(import.meta.dirname!, '..', 'deno.json')))
  const test_import_map_json = JSON.parse(await Deno.readTextFile(path.resolve(import.meta.dirname!, 'import_map.json')))

  for (const library_dependency of Object.keys(deno_json['imports'])) {
    assert_equals(deno_json['imports'][library_dependency], test_import_map_json['imports'][library_dependency])
  }
})
