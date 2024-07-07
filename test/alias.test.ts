import { test, assert_equals, expect_type } from './util.ts'
import { Model, Torm, SeedMigration, field } from '../drivers/sqlite.ts'


class TagGroup extends Model('tag_group', {
  id:         field.number(),
  name:       field.string(),
}) {
  create = this.query`INSERT INTO tag_group (name) VALUES (${TagGroup.params.name})`.exec
}

class Tag extends Model('tag', {
  id:           field.number(),
  name:         field.string(),
  tag_group_id: field.number()
}) {
  create = this.query`INSERT INTO tag (name, tag_group_id) VALUES (${Tag.params.name}, ${Tag.params.tag_group_id})`.exec

  search_tag_and_group = this.query`SELECT ${Tag.result.name}, ${TagGroup.result.name.as('group')} FROM tag
    INNER JOIN tag_group ON tag_group_id = tag_group.id
    WHERE tag.name LIKE ${Tag.params.name} || '%'`.all

  select_by__name__group = this.query`SELECT ${Tag.result['*']} FROM tag
    INNER JOIN tag_group ON tag_group_id = tag_group.id
    WHERE tag.name = ${Tag.params.name} AND tag_group.name = ${TagGroup.params.name.as('group')}`

  expose_prepare = this.prepare
}

class TagORM extends Torm {
  // models
  tag_group = this.model(TagGroup)
  tag       = this.model(Tag)
}

@TagORM.migrations.register()
class TagInitMigration extends SeedMigration {
  version = '1.0.0'

  call = () => this.prepare`
    CREATE TABLE tag_group (
      id INTEGER NOT NULL PRIMARY KEY,
      name TEXT NOT NULL
    )
  `.exec()
}

@TagORM.migrations.register()
class TagGroupInitMigration extends SeedMigration {
  version = '1.0.0'

  call = () => this.prepare`
    CREATE TABLE tag (
      id INTEGER NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      tag_group_id INTEGER NOT NULL,
      FOREIGN KEY(tag_group_id) REFERENCES tag_group(id)
    )
  `.exec()
}

test('field alias names', async (ctx) => {
  const db = new TagORM(ctx.create_fixture_path('test.db'))
  await db.init()

  const artist_tag_group_id = db.tag_group.create({ name: 'artist' }).last_insert_row_id
  const picasso_tag_id = db.tag.create({ name: 'picasso', tag_group_id: artist_tag_group_id }).last_insert_row_id

  const result = db.tag.search_tag_and_group({ name: 'pica' })
  expect_type<{ name: string; group: string }>(result[0])
  assert_equals(result, [{ name: 'picasso', group: 'artist' }])

  const stmt = db.tag.expose_prepare`SELECT ${Tag.result['*']} FROM tag WHERE name = '${'picasso'}'`
  const hardcoded_query = stmt.one()
  expect_type<{ id: number; name: string; tag_group_id: number } | undefined>(hardcoded_query)
  assert_equals(hardcoded_query, { id: picasso_tag_id, name: 'picasso', tag_group_id: artist_tag_group_id })

  // test params aliases
  assert_equals({
    id: 1,
    tag_group_id: 1,
    name: 'picasso',
  }, db.tag.select_by__name__group.one({group: 'artist', name: 'picasso'}))

  db.close()
})

