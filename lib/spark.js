import { once } from 'node:events'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { BrowserWindow } from 'electron'
import { createTestRunner } from './runner.js'

export function runMain (opts = {}) {
  return createTestRunner(opts)
}

export async function testMain (opts = {}) {
  let summary

  for await (let event of runMain(opts)) {
    if (event.type === 'test:summary')
      summary = event.data
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

    win.webContents.send('spark:start')
    await once(win.webContents.ipc, 'spark:done', { signal })

    return summary
  } finally {
    if (!win.isDestroyed()) win.close()
  }
}
