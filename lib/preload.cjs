'use strict'

const process = require('node:process')
const { ipcRenderer } = require('electron')
const { writeCoverage } = require('./coverage.js')
const { cloneError } = require('./errors.js')
const { createTestRunner } = require('./runner.js')

window.ELECTRON_DISABLE_SECURITY_WARNINGS = true

process
  .on('uncaughtException', fail)
  .on('unhandledRejection', fail)

window.addEventListener('error', (event) => {
  event.preventDefault()
  process.emit('uncaughtException', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault()
  process.emit('unhandledRejection', event.reason)
})

process.stdout.write = forward('test:stdout')
process.stderr.write = forward('test:stderr')

ipcRenderer.send('spark:ready')

ipcRenderer.on('spark:start', (_, { V8_COVERAGE_DIR, ...opts }) => {
  // Set explicitly: the inherited value may be the temp dir
  // of an in-process test.run() in the main process.
  if (V8_COVERAGE_DIR)
    process.env.NODE_V8_COVERAGE = V8_COVERAGE_DIR
  else
    delete process.env.NODE_V8_COVERAGE

  createTestRunner({
    ...opts,
    async beforeExit () {
      if (!process.env.NODE_V8_COVERAGE)
        return

      // NB: we need to write the coverage data here,
      // for source maps to resolve!
      await ipcRenderer
        .invoke('spark:coverage')
        .then(data => data && writeCoverage(data))
    },
    setup (stream) {
      stream
        .on('data', (event) => {
          ipcRenderer.send('spark:event', marshal(event))
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

function marshal (event) {
  if (event.data?.details?.error)
    event.data.details.error = cloneError(event.data.details.error)

  return event
}

function fail (err) {
  // Defer to listeners added later, e.g. by the node:test harness.
  if (process.listeners('uncaughtException').at(-1) !== fail) return

  ipcRenderer.sendSync('spark:error', err?.message ?? String(err))
  process.exit(1)
}
