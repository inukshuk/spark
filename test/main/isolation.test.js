import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runRenderer } from '../../lib/spark.js'
import { combine } from '../../lib/stream.js'
import { F } from '../support/fixtures.js'
import { assertTestNames, collectTests } from '../support/stream.js'

let files = [F.test('isolation-a'), F.test('isolation-b')]

describe('renderer isolation', () => {
  it('isolates global state between files', async () => {
    let events = await collectTests(
      combine(runRenderer({ files, isolation: 'process', concurrency: 2 })))
    let names = new Set(events.map(e => e.data.name))

    assert.deepEqual(names, new Set(['isolation a', 'isolation b']))
  })

  it('isolates with sequential window reuse', () =>
    assertTestNames(
      combine(runRenderer({ files, isolation: 'process', concurrency: 1 })),
      ['isolation a', 'isolation b']))

  it('shared window leaks state without isolation', () =>
    assertTestNames(
      combine(runRenderer({ files, isolation: 'none' })),
      ['isolation b'],
      'fail'))
})
