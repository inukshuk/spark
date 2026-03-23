import assert from 'node:assert/strict'
import { test } from 'node:test'

test('esm preload ran', () => {
  assert.equal(globalThis.SPARK_PRELOAD_ESM, true)
})

test('cjs preload ran', () => {
  assert.equal(globalThis.SPARK_PRELOAD_CJS, true)
})
