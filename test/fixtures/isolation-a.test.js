import assert from 'node:assert/strict'
import { test } from 'node:test'

test('isolation a', () => {
  assert.equal(document.title, '', 'title should start empty')
  document.title = 'a'
  assert.equal(document.title, 'a')
})
