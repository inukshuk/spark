import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { describe, it } from 'node:test'
import { combine } from '../../lib/stream.js'
import { collect } from '../support/stream.js'

const diagnostic = (message) =>
  ({ type: 'test:diagnostic', data: { nesting: 0, message } })

const summary = {
  type: 'test:summary',
  data: {
    counts: {
      passed: 1,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      todo: 0,
      suites: 0,
      tests: 1,
      topLevel: 1
    },
    duration_ms: 1,
    success: true
  }
}

describe('combine', () => {
  it('sums count diagnostics and passes others through', async () => {
    let error = 'Error: A resource generated asynchronous activity'

    let events = await collect(combine([
      Readable.from([diagnostic('tests 1'), diagnostic('duration_ms 1.5'), summary]),
      Readable.from([diagnostic(error), diagnostic('tests 1'), diagnostic('duration_ms 2'), summary])
    ]), 'test:diagnostic')

    assert.deepEqual(events.map(e => e.data.message), [
      error,
      'tests 2',
      'duration_ms 3.5'
    ])
  })
})
