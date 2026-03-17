import assert from 'node:assert/strict'
import { join } from 'node:path'

const FIXTURES = join(import.meta.dirname, 'fixtures')

export const F = {
  js: (name) => join(FIXTURES, `${name}.js`),
  test: (name) => join(FIXTURES, `${name}.test.js`)
}

export async function collect (stream, type) {
  let events = await stream.toArray()

  if (typeof type === 'function')
    return events.filter(type)
  if (type)
    return events.filter(e => e.type === type)
  else
    return events
}

export function collectTests (stream, status = 'pass') {
  return collect(stream, e => (
    e.type === `test:${status}` && e.data.details?.type === 'test'
  ))
}

export async function assertTestNames (stream, expected, status = 'pass') {
  let events = await collectTests(stream, status)
  let names = events.map(e => e.data.name)
  assert.deepEqual(names, expected)
}
