import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { run } from '../../lib/spark.js'

describe('run routing', () => {
  let runMain, runRenderer

  beforeEach(() => {
    runMain = mock.method(run, 'runMain', () => {}).mock
    runRenderer = mock.method(run, 'runRenderer', () => []).mock
  })
  afterEach(() => {
    runMain.restore()
    runRenderer.restore()
  })

  let opts = (m) => (m.calls[0].arguments[0])

  it('routes globPatterns to main', () => {
    run({ globPatterns: ['test/**'] })

    assert.equal(runMain.callCount(), 1)
    assert.deepEqual(opts(runMain).globPatterns, ['test/**'])
    assert.equal(runRenderer.callCount(), 0)
  })

  it('routes globPatterns with show to renderer', () => {
    run({ globPatterns: ['test/**'], show: true })

    assert.equal(runMain.callCount(), 0)
    assert.equal(runRenderer.callCount(), 1)
    assert.deepEqual(opts(runRenderer).globPatterns, ['test/**'])
  })

  it('routes globPatterns with url to renderer', () => {
    run({ globPatterns: ['test/**'], url: 'http://localhost' })

    assert.equal(runMain.callCount(), 0)
    assert.equal(runRenderer.callCount(), 1)
    assert.deepEqual(opts(runRenderer).globPatterns, ['test/**'])
  })

  it('runs both with qualified globs', () => {
    run({ mainGlobPatterns: ['main/**'], rendererGlobPatterns: ['renderer/**'] })

    assert.equal(runMain.callCount(), 1)
    assert.deepEqual(opts(runMain).globPatterns, ['main/**'])
    assert.equal(runRenderer.callCount(), 1)
    assert.deepEqual(opts(runRenderer).globPatterns, ['renderer/**'])
  })

  it('runs main with defaults when no globs', () => {
    run()

    assert.equal(runMain.callCount(), 1)
    assert.equal(opts(runMain).globPatterns, undefined)
    assert.equal(runRenderer.callCount(), 0)
  })

  it('merges switches into execArgv', () => {
    run({ switches: ['--no-sandbox'], execArgv: ['--existing'] })

    assert.equal(runMain.callCount(), 1)
    assert.deepEqual(opts(runMain).execArgv, ['--existing', '--no-sandbox'])
  })
})
