import { once } from 'node:events'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { createTestRunner } from './runner.js'

export function runMain ({ forward, ...opts } = {}) {
  return new Promise((resolve, reject) => {
    let summary

    createTestRunner({
      ...opts,
      setup (stream) {
        stream
          .on('data', (event) => {
            forward?.(event)
            if (event.type === 'test:summary')
              summary = event.data
          })
          .on('end', () => resolve(summary))
          .on('error', reject)
      }
    })
  })
}

export async function runRenderer ({
  forward,
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
      forward?.(event)

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
