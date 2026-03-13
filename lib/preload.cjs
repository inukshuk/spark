const { ipcRenderer } = require('electron')
const { run } = require('node:test')
const reporters = require('node:test/reporters')
const { finished } = require('node:stream/promises')
const { Writable } = require('node:stream')

let failures = 0
let pending = 0

let source = run({
  files: [
    'test/renderer/process_test.js'
  ],
  isolation: 'none',
  watch: false
})

source.on('test:enqueue', () => { ++pending })
source.on('test:complete', () => {
  if (--pending === 0)
    process.emit('beforeExit')
})
source.on('test:fail', () => { ++failures })

source.compose(reporters.spec).pipe(new Writable({
  write (chunk, encoding, cb) {
    ipcRenderer.send('test:output', chunk.toString())
    cb()
  }
}))

finished(source).then(() => {
  ipcRenderer.send('test:done', failures)
})
