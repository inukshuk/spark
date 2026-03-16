import assert from 'node:assert/strict'
import process from 'node:process'
import { test } from 'node:test'

test('renderer process', () => {
  assert.equal(process.type, 'renderer')
})
