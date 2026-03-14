const { argv } = require('node:process')
const { ipcRenderer } = require('electron')
const { run } = require('./run.js')

window.ELECTRON_DISABLE_SECURITY_WARNINGS = true

let opts = JSON.parse(
  argv.find(a => a.startsWith('--spark=')).slice(8)
)

run({
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
