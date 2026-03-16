import assert from 'node:assert'
import process from 'node:process'
import { test } from 'node:test'

test('renderer process', () => {
  assert.equal(process.type, 'renderer')
})
