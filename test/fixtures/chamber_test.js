import assert from 'node:assert/strict'
import process from 'node:process'
import { test } from 'node:test'
import { ionize, detect } from './chamber.js'

if (process.type === 'browser') {
  test('ionize', () => {
    assert.equal(ionize('neon', 50).particles, 2)
    assert.equal(ionize('neon', 10), null)
  })
} else {
  test('detect', () => {
    assert.equal(detect({ particles: 3 }), true)
    assert.equal(detect(null), false)
  })
}
