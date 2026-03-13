import assert from 'node:assert'
import process from 'node:process'
import { test } from 'node:test'

test('main process', () => {
  assert.equal(process.type, 'browser')
})
