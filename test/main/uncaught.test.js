import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runMain, runRenderer } from '../../lib/spark.js'
import { F } from '../support/fixtures.js'
import { collect } from '../support/stream.js'

let files = [F.test('uncaught')]

async function results (stream) {
  let events = await collect(stream)
  let names = (type) => events
    .filter(e => e.type === type && e.data.details?.type === 'test')
    .map(e => e.data.name)

  return {
    pass: names('test:pass'),
    fail: names('test:fail'),
    diagnostics: events
      .filter(e => e.type === 'test:diagnostic')
      .map(e => e.data.message)
  }
}

describe('uncaught errors', () => {
  it('fail the current test in the renderer', async () => {
    let { pass, fail, diagnostics } = await results(runRenderer({ files })[0])

    assert.deepEqual(fail, ['listener throws'])
    assert.ok(pass.includes('runs after'), 'renderer kept running')
    assert.ok(diagnostics.some(m => m.includes('boom')), 'timer error reported')
  })

  it('fail the current test in a child process', async () => {
    let { pass, fail } = await results(runMain({ files, isolation: 'process' }))

    assert.deepEqual(fail, ['timer throws'])
    assert.ok(pass.includes('runs after'), 'child kept running')
  })
})
