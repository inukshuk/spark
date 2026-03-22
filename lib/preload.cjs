'use strict'

const process = require('node:process')
const { ipcRenderer } = require('electron')
const { createTestRunner } = require('./runner.js')

window.ELECTRON_DISABLE_SECURITY_WARNINGS = true

process
  .on('uncaughtException', fail)
  .on('unhandledRejection', fail)

process.stdout.write = forward('test:stdout')
process.stderr.write = forward('test:stderr')

ipcRenderer.send('spark:ready')

ipcRenderer.on('spark:start', (_, opts) => {
  createTestRunner({
    ...opts,
    setup (stream) {
      stream
        .on('data', (event) => {
          ipcRenderer.send('spark:event', event)
        })
        .on('end', () => {
          ipcRenderer.send('spark:done')
        })
    }
  })
})

function forward (type) {
  return (chunk, encoding, callback) => {
    if (typeof encoding === 'function') {
      callback = encoding
      encoding = undefined
    }

    ipcRenderer.send('spark:event', {
      type,
      data: {
        message: typeof chunk === 'string'
          ? chunk
          : chunk.toString(encoding)
      }
    })

    if (callback) callback()
    return true
  }
}

function fail (err) {
  process.stderr.write(`${err?.stack ?? err}\n`)
  setImmediate(() => process.exit(1))
}
