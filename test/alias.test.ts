import { test, assert_equals, expect_type } from './util.ts'
import { Model, Torm, Migration, field } from '../drivers/sqlite.ts'


class TagGroup extends Model('tag_group', {
  id:         field.number(),
  name:       field.string(),
}) {
  static migrations = {
    initialization: Migration.create('1.0.0', `
      CREATE TABLE tag_group (
        id INTEGER NOT NULL PRIMARY KEY,
        name TEXT NOT NULL
      )`)
  }
  create = this.query`INSERT INTO tag_group (name) VALUES (${TagGroup.params.name})`.exec
}

class Tag extends Model('tag', {
  id:           field.number(),
  name:         field.string(),
  tag_group_id: field.number()
}) {
  static migrations = {
    initialization: Migration.create('1.0.0', `
      CREATE TABLE tag (
        id INTEGER NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        tag_group_id INTEGER NOT NULL,
        FOREIGN KEY(tag_group_id) REFERENCES tag(tag_group_id)
      )`)
  }

  create = this.query`INSERT INTO tag (name, tag_group_id) VALUES (${Tag.params.name}, ${Tag.params.tag_group_id})`.exec

  search_tag_and_group = this.query`SELECT ${Tag.result.name}, ${TagGroup.result.name.as('group')} FROM tag
    INNER JOIN tag_group ON tag_group_id = tag_group.id
    WHERE tag.name LIKE ${Tag.params.name} || '%'`.all
}

class TagORM extends Torm {
  static migrations = { version: '1.0.0' }

  // models
  tag_group = this.model(TagGroup)
  tag       = this.model(Tag)
}

test('field alias names', async (ctx) => {
  const db = new TagORM(ctx.fixture_path('test.db'))
  await db.init()

  const artist_tag_group_id = db.tag_group.create({ name: 'artist' }).last_insert_row_id
  db.tag.create({ name: 'picasso', tag_group_id: artist_tag_group_id })

  const result = db.tag.search_tag_and_group({ name: 'pica' })
  expect_type<{ name: string; group: string }>(result[0])
  assert_equals(result, [{ name: 'picasso', group: 'artist' }])

  db.close()
})

