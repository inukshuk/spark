const { ipcRenderer } = require('electron')
const { run } = require('./run.js')

let source = run({
  files: [
    'test/renderer/process_test.js'
  ]
})

source.on('data', (event) => {
  ipcRenderer.send('test:event', event)
})

source.on('end', () => {
  ipcRenderer.send('test:done')
})
