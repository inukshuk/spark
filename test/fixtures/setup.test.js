import assert from 'node:assert/strict'
import { after, test } from 'node:test'

test('global setup ran before tests', () => {
  assert.equal(process.env.SPARK_SETUP, '1')
})

test('module imported before app ready', () => {
  assert.equal(process.env.SPARK_APP_READY, '0')
})

after(() => {
  assert(!('SPARK_TEARDOWN' in process.env), 'globalTeardown ran too early')
})
