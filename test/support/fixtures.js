import { join } from 'node:path'

const FIXTURES = join(import.meta.dirname, '../fixtures')

export const F = {
  join: (name) => join(FIXTURES, name),
  js: (name) => join(FIXTURES, `${name}.js`),
  test: (name) => join(FIXTURES, `${name}.test.js`)
}
