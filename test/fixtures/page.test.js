import assert from 'node:assert/strict'
import { test } from 'node:test'

test('file: page', () => {
  assert.equal(window.location.protocol, 'file:')
})
