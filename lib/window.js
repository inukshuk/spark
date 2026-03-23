import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import config from './config.js'

export function createWindow ({
  show,
  webPreferences
} = {}) {
  let window = new BrowserWindow({
    ...config.window,
    show,
    webPreferences: {
      ...config.webPreferences,
      ...webPreferences,
      preload: join(import.meta.dirname, './preload.cjs'),
      sandbox: false
    }
  })

  let ac = new AbortController()

  window.on('closed', () => {
    ac.abort(new Error(`[${window.id}]: closed`, { cause: 'closed' }))
  })

  window.webContents.on('render-process-gone', (_, { exitCode, reason }) => {
    ac.abort(new Error(
      `[${window.id}]: exited (${exitCode}) ${reason}`,
      { cause: 'render-process-gone' }
    ))
  })

  return {
    window,
    signal: ac.signal,
    abort: (reason) => ac.abort(reason),
    close: () => {
      if (!window.isDestroyed()) window.destroy()
    }
  }
}

export function load (win, url) {
  if (win.webContents.getURL() === url)
    win.webContents.reload()
  else
    win.loadURL(url)
}
