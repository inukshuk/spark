import { once } from 'node:events'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { app, BrowserWindow } from 'electron'
import config from './config.js'
import { debug } from './log.js'
import { startCoverage } from './coverage.js'
import { filterStdErr, combine } from './stream.js'
import { createTestRunner } from './runner.js'

const CHROMIUM_ERROR = /^\[\d+:\d+\/[\d.]+:\w+:/
const defaultExecArgv = app.commandLine.hasSwitch('no-sandbox') ? ['--no-sandbox'] : []

export function run ({
  main,
  renderer,
  switches,
  reporter,
  destination,
  help,
  version,
  verbose,
  globalSetupPath,
  ...opts
} = {}) {
  if (switches?.length)
    opts.execArgv = [...(opts.execArgv ?? []), ...switches]

  let streams = []

  if (main || !renderer)
    streams.push(runMain({ globPatterns: main, ...opts }))

  if (renderer)
    streams.push(runRenderer({ globPatterns: renderer, ...opts }))

  return combine(streams)
}

export function runMain ({
  execArgv = defaultExecArgv,
  isolation = 'none',
  ...opts
} = {}) {
  let stream = createTestRunner({ execArgv, isolation, ...opts })

  if (isolation === 'process') {
    stream = stream.pipe(filterStdErr(CHROMIUM_ERROR))
  }

  return stream
}

export function runRenderer (opts = {}) {
  let out = new PassThrough({ objectMode: true })

  testRenderer({ out, ...opts })
    .then(() => out.end())
    .catch(err => {
      if (!out.destroyed) out.destroy(err)
    })

  return out
}

async function testRenderer ({
  out,
  onConsole,
  coverage,
  show = config.show,
  url = config.url,
  ...opts
} = {}) {
  let win = new BrowserWindow({
    show,
    webPreferences: {
      additionalArguments: [`--spark=${JSON.stringify(opts)}`],
      preload: join(import.meta.dirname, './preload.cjs'),
      sandbox: false,
      backgroundThrottling: false,
      disableDialogs: true,
      spellcheck: false
    }
  })

  try {
    let ac = new AbortController()
    let { signal } = ac
    let summary
    let run = 0

    win.on('closed', () => {
      debug(`[${win.id}]: window closed`)
      ac.abort()
    })

    win.webContents
      .on('render-process-gone', (_, { exitCode, reason }) => {
        ac.abort(new Error(`Renderer process exited: (${exitCode}) ${reason}`))
      })
      .on('console-message', (details) => {
        onConsole?.(details)
      })

    win.webContents.ipc.on('spark:event', (_, event) => {
      out?.write(event)

      if (event.type === 'test:summary')
        summary = event.data
    })

    debug(`[${win.id}]: loading ${url}`)
    win.loadURL(url)

    try {
      while (true) {
        await Promise.all([
          once(win.webContents, 'dom-ready', { signal }),
          once(win.webContents.ipc, 'spark:ready', { signal })
        ])

        debug(`[${win.id}]: spark:ready`)

        if (run++ > 0) {
          out?.write({ type: 'test:watch:restarted' })
        }

        if (coverage && run === 1)
          var stopCoverage = await startCoverage(out, win.webContents)

        debug(`[${win.id}]: spark:start`)
        win.webContents.send('spark:start')

        await once(win.webContents.ipc, 'spark:done', { signal })
        debug(`[${win.id}]: spark:done`)

        if (!show) break
      }
    } catch (err) {
      if (!show || err.code !== 'ABORT_ERR') throw err
    }

    if (coverage)
      var data = await stopCoverage()

    return {
      summary,
      coverage: data
    }
  } finally {
    if (!win.isDestroyed()) win.close()
  }
}
