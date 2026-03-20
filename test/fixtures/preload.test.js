import assert from 'node:assert/strict'
import { test } from 'node:test'

test('module imported before tests', () => {
  assert.equal(globalThis.SPARK_IMPORTED, true)
})
