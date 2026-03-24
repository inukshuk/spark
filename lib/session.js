import { env } from 'node:process'
import config from './config.js'
import { startCoverage } from './coverage.js'
import { debug } from './log.js'

export default class TestSession {
  #ac
  #disposers = []
  #out
  #stopCoverage = null
  #summary = null
  #win

  static run (win, out, args, opts) {
    return new TestSession(win, out).run(args, opts)
  }

  constructor (win, out) {
    this.#win = win
    this.#out = out
    this.#ac = new AbortController()

    this
      .on(win.webContents, 'console-message', ({ level, message }) => {
        out?.write({
          type: `test:${level === 'info' ? 'stdout' : 'stderr'}`,
          data: { message: message + '\n' }
        })
      })
      .on(win.webContents, 'render-process-gone', (_, { exitCode, reason }) => {
        this.#ac.abort(new Error(
          `[${win.id}]: exited (${exitCode}) ${reason}`, {
            cause: 'render-process-gone'
          }
        ))
      })
      .on(win.webContents.ipc, 'spark:error', (_, message) => {
        debug('spark:error')
        this.#ac.abort(new Error(message))
      })
      .on(win.webContents.ipc, 'spark:event', (_, event) => {
        if (event.type === 'test:summary')
          this.#summary = event
        else
          out?.write(event)
      })
  }

  async run (args, {
    coverage,
    coverageExcludeGlobs = config.coverageExcludeGlobs,
    coverageIncludeGlobs = config.coverageIncludeGlobs,
    url = 'spark://chamber'
  } = {}) {
    let win = this.#win
    let out = this.#out
    let numRuns = 0

    let signal = AbortSignal.any([
      this.#ac.signal,
      this.#win.signal
    ])

    try {
      win.signal.throwIfAborted()

      debug(`[${win.id}]: loading ${url}`)
      win.load(url)

      while (true) {
        await Promise.all([
          win.once('dom-ready', { signal }),
          win.once('spark:ready', { signal })
        ])

        debug(`[${win.id}]: spark:ready`)

        if (numRuns++ > 0)
          out?.write({ type: 'test:watch:restarted' })

        if (coverage || env.NODE_V8_COVERAGE)
          this.#stopCoverage = await startCoverage(win.webContents, {
            coverageExcludeGlobs,
            coverageIncludeGlobs
          })

        debug(`[${win.id}]: spark:start`)
        win.send('spark:start', args)

        await win.once('spark:done', { signal })
        debug(`[${win.id}]: spark:done`)

        let data = await this.#stopCoverage?.()
        if (coverage && data)
          out?.write({ type: 'test:coverage', data })
        if (this.#summary)
          out?.write(this.#summary)

        this.#stopCoverage = null
        this.#summary = null

        if (!win.isVisible) break
      }
    } catch (err) {
      if (err.code === 'ABORT_ERR')
        err = err.cause

      if (err.cause !== 'closed') {
        debug(err.message)
        out?.write(TestFailure(err.message ?? String(err)))
        out?.write(TestSummary({ failed: 1 }))
      }
    } finally {
      for (let dispose of this.#disposers) dispose()
    }
  }

  on (target, event, handler) {
    target.on(event, handler)
    this.#disposers.push(() => target.off(event, handler))
    return this
  }
}

const TestFailure = (error) => ({
  type: 'test:fail',
  data: {
    name: 'renderer',
    nesting: 0,
    testNumber: 1,
    details: {
      duration_ms: 0,
      error,
      type: 'test'
    }
  }
})

const TestSummary = ({
  passed = 0,
  failed = 0
} = {}) => ({
  type: 'test:summary',
  data: {
    counts: {
      passed,
      failed,
      cancelled: 0,
      skipped: 0,
      todo: 0,
      suites: 0,
      tests: passed + failed,
      topLevel: 1
    },
    success: failed === 0
  }
})
