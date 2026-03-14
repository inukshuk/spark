const { ipcRenderer } = require('electron')
const { run } = require('./run.js')

window.ELECTRON_DISABLE_SECURITY_WARNINGS = true

run({
  files: [
    'test/renderer/process_test.js'
  ],
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
