import { once } from 'node:events'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import config from './config.js'

export default class TestWindow {
  #win
  #ac

  constructor ({
    show,
    webPreferences,
    ...opts
  } = {}) {
    this.#win = new BrowserWindow({
      ...config.window,
      ...opts,
      show,
      webPreferences: {
        ...config.webPreferences,
        ...webPreferences,
        preload: join(import.meta.dirname, './preload.cjs'),
        sandbox: false
      }
    })
    this.#ac = new AbortController()

    this.#win.on('closed', () => {
      this.#ac.abort(new Error(`[${this.id}]: closed`, {
        cause: 'closed'
      }))
    })
  }

  get id () {
    return this.#win.id
  }

  get signal () {
    return this.#ac.signal
  }

  get closed () {
    return this.#ac.signal.aborted
  }

  get webContents () {
    return this.#win.webContents
  }

  load (url) {
    if (this.#win.webContents.getURL() === url)
      this.#win.webContents.reload()
    else
      this.#win.loadURL(url)
  }

  send (channel, ...args) {
    this.#win.webContents.send(channel, ...args)
  }

  close () {
    if (!this.#win.isDestroyed()) this.#win.destroy()
  }

  once (event, opts) {
    let emitter = event.startsWith('spark:')
      ? this.#win.webContents.ipc
      : this.#win.webContents
    return once(emitter, event, opts)
  }

  acquire (handlers = {}) {
    let ac = new AbortController()
    let cleanups = []

    let onWindowAbort = () => ac.abort(this.signal.reason)
    this.signal.addEventListener('abort', onWindowAbort)
    cleanups.push(() => this.signal.removeEventListener('abort', onWindowAbort))

    let onProcessGone = (_, { exitCode, reason }) => {
      ac.abort(new Error(
        `[${this.id}]: exited (${exitCode}) ${reason}`,
        { cause: 'render-process-gone' }
      ))
    }
    this.#win.webContents.on('render-process-gone', onProcessGone)
    cleanups.push(() => this.#win.webContents.off('render-process-gone', onProcessGone))

    let onError = (_, message) => ac.abort(new Error(message))
    this.#win.webContents.ipc.on('spark:error', onError)
    cleanups.push(() => this.#win.webContents.ipc.off('spark:error', onError))

    for (let [event, handler] of Object.entries(handlers)) {
      let emitter = event.startsWith('spark:')
        ? this.#win.webContents.ipc
        : this.#win.webContents
      emitter.on(event, handler)
      cleanups.push(() => emitter.off(event, handler))
    }

    return {
      signal: ac.signal,
      release () { for (let fn of cleanups) fn() }
    }
  }
}
