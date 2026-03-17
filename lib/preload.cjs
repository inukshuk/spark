const process = require('node:process')
const { ipcRenderer } = require('electron')
const { createTestRunner } = require('./runner.js')

window.ELECTRON_DISABLE_SECURITY_WARNINGS = true

process.on('uncaughtException', (err) => {
  process.stderr.write(`${err?.stack ?? err}\n`)
  process.exit(1)
})

let opts = JSON.parse(
  process.argv.find(a => a.startsWith('--spark=')).slice(8)
)

ipcRenderer.send('spark:ready')

ipcRenderer.on('spark:start', () => {
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
