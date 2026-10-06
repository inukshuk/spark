import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { before, describe, it } from 'node:test'
import { stripVTControlCharacters } from 'node:util'
import { reporters } from '../../lib/reporters/index.js'
import { sym } from '../../lib/reporters/symbols.js'
import { runMain } from '../../lib/spark.js'
import { F } from '../support/fixtures.js'
import { collect } from '../support/stream.js'

async function report (reporter, events) {
  let chunks = await Readable.from(events).compose(reporter).toArray()
  return stripVTControlCharacters(chunks.join(''))
    .split(/\r?\n/)
    .map(line => line.trim())
}

describe('reporters', () => {
  let events

  before(async () => {
    events = await collect(runMain({
      files: [F.test('suite-throws')],
      isolation: 'process'
    }))
  })

  describe('with failing suite', () => {
    it('sparks reports and counts it', async () => {
      let FAIL = sym.sparks.fail
      let lines = await report(reporters.sparks, events)

      assert.ok(lines.some(l => l.includes(`${FAIL} 1 fail`)), 'counted')
      assert.ok(lines.includes(`${FAIL} broken suite`), 'listed')
      assert.ok(lines.includes('suite body failed'), 'error shown')
    })

    it('beamline reports and counts it', async () => {
      let FAIL = sym.beamline.fail
      let lines = await report(reporters.beamline(), events)

      let mark = lines.findIndex(l => l.startsWith(`${FAIL} broken suite (`))
      let summary = lines.indexOf(`${FAIL} 1 fail`)

      assert.ok(mark >= 0, 'marked in test list')
      assert.ok(summary > mark, 'counted in summary')
      assert.ok(lines.includes(`${FAIL} broken suite`), 'listed')
      assert.ok(lines.some(l => l.endsWith('suite body failed')), 'error shown')
    })
  })
})
