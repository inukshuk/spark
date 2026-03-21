'use strict'

const process = require('node:process')
const { ipcRenderer } = require('electron')
const { createTestRunner } = require('./runner.js')

window.ELECTRON_DISABLE_SECURITY_WARNINGS = true

process
  .on('uncaughtException', fail)
  .on('unhandledRejection', fail)

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

function fail (err) {
  process.stderr.write(`${err?.stack ?? err}\n`)
  process.exit(1)
}
