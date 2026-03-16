import assert from 'node:assert/strict'
import process from 'node:process'
import { test } from 'node:test'

test('main process', () => {
  assert.equal(process.type, 'browser')
})
