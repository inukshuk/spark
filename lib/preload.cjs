const { ipcRenderer } = require('electron')
const { run } = require('./run.js')

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
