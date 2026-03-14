const { argv } = require('node:process')
const { ipcRenderer } = require('electron')
const { createTestRunner } = require('./runner.js')

window.ELECTRON_DISABLE_SECURITY_WARNINGS = true

let opts = JSON.parse(
  argv.find(a => a.startsWith('--spark=')).slice(8)
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
