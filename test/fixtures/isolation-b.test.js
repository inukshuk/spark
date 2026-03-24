import assert from 'node:assert/strict'
import { test } from 'node:test'

test('isolation b', () => {
  assert.equal(document.title, '', 'title should start empty')
  document.title = 'b'
  assert.equal(document.title, 'b')
})
