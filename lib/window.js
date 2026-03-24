import { once } from 'node:events'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import config from './config.js'

export default class TestWindow {
  #win
  #ac

  constructor ({ show, webPreferences, ...opts } = {}) {
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

  get isVisible () {
    return !this.#win.isDestroyed() && this.#win.isVisible()
  }

  get id () {
    return this.#win.id
  }

  get signal () {
    return this.#ac.signal
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
    if (!this.#win.isDestroyed())
      this.#win.destroy()
  }

  once (event, opts) {
    let emitter = event.startsWith('spark:')
      ? this.#win.webContents.ipc
      : this.#win.webContents
    return once(emitter, event, opts)
  }
}
