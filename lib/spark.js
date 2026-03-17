import { once } from 'node:events'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { app, BrowserWindow } from 'electron'
import { startInspector, startDebugger } from './coverage.js'
import { combine } from './stream.js'
import { createTestRunner } from './runner.js'

const defaultExecArgv = app.commandLine.hasSwitch('no-sandbox') ? ['--no-sandbox'] : []

export function run ({ main, renderer, switches, reporter, destination, help, version, verbose, globalSetupPath, ...opts } = {}) {
  if (switches?.length)
    opts.execArgv = [...(opts.execArgv ?? []), ...switches]

  let streams = []

  if (main || !renderer)
    streams.push(runMain({ globPatterns: main, ...opts }))

  if (renderer)
    streams.push(runRenderer({ globPatterns: renderer, ...opts }))

  return combine(streams)
}

export function runMain ({ execArgv = defaultExecArgv, ...opts } = {}) {
  if (!opts.coverage) return createTestRunner({ execArgv, ...opts })

  let out = new PassThrough({ objectMode: true })

  testMain({ out, execArgv, ...opts })
    .then(() => out.end())
    .catch(err => {
      if (!out.destroyed) out.destroy(err)
    })

  return out
}

async function testMain ({ out, coverage, ...opts } = {}) {
  if (coverage)
    var stopInspector = await startInspector(out)

  let stream = createTestRunner(opts)
  let summary

  for await (let event of stream) {
    out?.write(event)

    if (event.type === 'test:summary')
      summary = event.data
  }

  if (coverage)
    var lcov = await stopInspector()

  return { summary, coverage: lcov }
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
  url = 'spark://chamber',
  ...opts
} = {}) {
  let win = new BrowserWindow({
    show: false,
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

    win.loadURL(url)

    await Promise.all([
      once(win.webContents, 'dom-ready', { signal }),
      once(win.webContents.ipc, 'spark:ready', { signal })
    ])

    if (coverage)
      var stopDebugger = await startDebugger(out, win.webContents)

    win.webContents.send('spark:start')
    await once(win.webContents.ipc, 'spark:done', { signal })

    if (coverage)
      var lcov = await stopDebugger()

    return { summary, coverage: lcov }
  } finally {
    if (!win.isDestroyed()) win.close()
  }
}
