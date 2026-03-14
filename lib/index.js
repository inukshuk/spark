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

export function runRenderer ({
  forward,
  onConsole,
  url = 'about:blank',
  ...opts
} = {}) {
  let win

  return new Promise((resolve, reject) => {
    let summary

    win = new BrowserWindow({
      show: false,
      webPreferences: {
        additionalArguments: [
          `--spark=${JSON.stringify(opts)}`,
        ],
        preload: join(import.meta.dirname, './preload.cjs'),
        sandbox: false
      }
    })

    win.webContents.ipc
      .on('spark:event', (_, event) => {
        forward?.(event)
        if (event.type === 'test:summary')
          summary = event.data
      })
      .on('spark:done', () => resolve(summary))

    win.webContents
      .on('render-process-gone', (_, details) => {
        reject(new Error(`Renderer process gone: ${details.reason}`))
      })
      .on('console-message', (details) => onConsole?.(details))

    win.loadURL(url)
  }).finally(() => {
    if (!win?.isDestroyed()) win.close()
  })
}
