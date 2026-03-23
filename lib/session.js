import { env } from 'node:process'
import config from './config.js'
import { startCoverage } from './coverage.js'
import { debug } from './log.js'

export default class TestSession {
  #win
  #out
  #ac
  #disposers = []
  #summary = null
  #stopCoverage = null

  constructor (win, out) {
    this.#win = win
    this.#out = out
    this.#ac = new AbortController()

    this
      .on(win.signal, 'abort', () => {
        this.#ac.abort(win.signal.reason)
      })
      .on(win.webContents, 'render-process-gone', (_, { exitCode, reason }) => {
        this.#ac.abort(new Error(
          `[${win.id}]: exited (${exitCode}) ${reason}`, {
            cause: 'render-process-gone'
          }
        ))
      })
      .on(win.webContents.ipc, 'spark:error', (_, message) => {
        this.#ac.abort(new Error(message))
      })
      .on(win.webContents, 'console-message', ({ level, message }) => {
        out?.write({
          type: `test:${level === 'info' ? 'stdout' : 'stderr'}`,
          data: { message: message + '\n' }
        })
      })
      .on(win.webContents.ipc, 'spark:event', (_, event) => {
        if (event.type === 'test:summary')
          this.#summary = event
        else
          out?.write(event)
      })
  }

  static run (win, out, args, opts) {
    return new TestSession(win, out).run(args, opts)
  }

  get signal () {
    return this.#ac.signal
  }

  async run (args, {
    coverage,
    coverageExcludeGlobs = config.coverageExcludeGlobs,
    coverageIncludeGlobs = config.coverageIncludeGlobs,
    url = 'spark://chamber'
  } = {}) {
    let { signal } = this
    let win = this.#win
    let out = this.#out
    let numRuns = 0

    try {
      if (win.signal.aborted)
        throw win.signal.reason

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
      debug(err.message)
      if (!win.isVisible || err.cause !== 'closed') {
        throw err
      }
    } finally {
      for (let dispose of this.#disposers) dispose()
    }
  }

  on (target, event, handler) {
    if (target.addEventListener) {
      target.addEventListener(event, handler)
      this.#disposers.push(() => target.removeEventListener(event, handler))
    } else {
      target.on(event, handler)
      this.#disposers.push(() => target.off(event, handler))
    }
    return this
  }
}
