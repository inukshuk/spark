import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runMain, runRenderer } from '../../lib/spark.js'
import { F } from '../support.js'

function testNames (events) {
  return events
    .filter(e => e.type === 'test:pass' && e.data.details?.type === 'test')
    .map(e => e.data.name)
}

test('bdd with process isolation', async () => {
  let events = await runMain({
    files: [F.test('bdd')],
    isolation: 'process',
    ui: 'bdd'
  }).toArray()
  assert.deepStrictEqual(testNames(events), ['works', 'alias', 'also works'])
})

test('tdd with process isolation', async () => {
  let events = await runMain({
    files: [F.test('tdd')],
    isolation: 'process',
    ui: 'tdd'
  }).toArray()
  assert.deepStrictEqual(testNames(events), ['works'])
})

test('bdd in renderer', async () => {
  let events = await runRenderer({
    files: [F.test('bdd')],
    ui: 'bdd'
  }).toArray()
  assert.deepStrictEqual(testNames(events), ['works', 'alias', 'also works'])
})
