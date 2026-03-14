import { once } from 'node:events'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { BrowserWindow } from 'electron'
import { startInspector, startDebugger } from './coverage.js'
import { createTestRunner } from './runner.js'

export function runMain (opts = {}) {
  if (!opts.coverage) return createTestRunner(opts)

  let out = new PassThrough({ objectMode: true })

  testMain({ out, ...opts })
    .then(() => out.end())
    .catch(err => {
      if (!out.destroyed) out.destroy(err)
    })

  return out
}

export async function testMain ({ out, coverage, ...opts } = {}) {
  let stop
  if (coverage) stop = await startInspector()

  let stream = createTestRunner(opts)
  let summary

  for await (let event of stream) {
    out?.write(event)

    if (event.type === 'test:summary')
      summary = event.data
  }

  if (stop) {
    let data = await stop()
    out?.write({ type: 'test:coverage', data })
  }

  return summary
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

export async function testRenderer ({
  out,
  onConsole,
  coverage,
  url = 'about:blank',
  ...opts
} = {}) {
  let win = new BrowserWindow({
    show: false,
    webPreferences: {
      additionalArguments: [`--spark=${JSON.stringify(opts)}`],
      preload: join(import.meta.dirname, './preload.cjs'),
      sandbox: false
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

    let stop
    if (coverage) stop = await startDebugger(win.webContents)

    win.webContents.send('spark:start')
    await once(win.webContents.ipc, 'spark:done', { signal })

    if (stop) {
      let data = await stop()
      out?.write({ type: 'test:coverage', data })
    }

    return summary
  } finally {
    if (!win.isDestroyed()) win.close()
  }
}
