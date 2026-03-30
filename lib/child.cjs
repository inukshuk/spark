'use strict'

const process = require('node:process')
const { app } = require('electron')
const { before, after } = require('node:test')

app.setName('spark')
require('./init.js').default()

if (!app.commandLine.hasSwitch('log-level'))
  app.commandLine.appendSwitch('log-level', '3')

process
  .on('uncaughtException', fail)
  .on('unhandledRejection', fail)

// Expose on SPARK_UI
require('./ui.cjs')

before(() => app.whenReady())

// Electron's event loop does not drain,
// so tests spawned with isolation: 'process' never exit.
// The after hook runs when all tests complete,
// giving us a chance to force exit.
// Also flush V8 coverage before exit so NODE_V8_COVERAGE files are written.
after(() => {
  const v8 = require('node:v8')
  v8.takeCoverage()
  setImmediate(() => process.exit())
})

function fail (err) {
  process.stderr.write(`${err?.stack ?? err}\n`)
  process.exit(1)
}
