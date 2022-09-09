# TORM
A typesafe database ORM that exposes the full power of handwritten sql statements to the developer.

## Roadmap to 1.0
- [X] `SELECT ${Book.schema.id}` tagged template literal type translation
- [X] `SELECT ${[Book.schema.id, Book.schema.title]}` array param support
- [ ] `SELECT ${Book.schema['*']}` helper
- [ ] `SELECT ${Book.result['*']} FROM book WHERE id = ${Book.params.id}` param & result nominal types
- [ ] runtime implementation
  - [ ] driver bridges
    - [ ] `sqlite-native`
    - [ ] `better-sqlite3`
