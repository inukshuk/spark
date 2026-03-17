import { test } from 'node:test'
import { runMain, runRenderer } from '../../lib/spark.js'
import { F } from '../support/fixtures.js'
import { assertTestNames } from '../support/stream.js'

test('bdd with process isolation', () =>
  assertTestNames(runMain({
    files: [F.test('bdd')],
    isolation: 'process',
    ui: 'bdd'
  }), ['works', 'alias', 'also works']))

test('tdd with process isolation', () =>
  assertTestNames(runMain({
    files: [F.test('tdd')],
    isolation: 'process',
    ui: 'tdd'
  }), ['works']))

test('bdd in renderer', () =>
  assertTestNames(runRenderer({
    files: [F.test('bdd')],
    ui: 'bdd'
  }), ['works', 'alias', 'also works']))
