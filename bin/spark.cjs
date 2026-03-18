#!/usr/bin/env node

'use strict'

const console = require('node:console')
const process = require('node:process')
const { join } = require('node:path')
const { spawn } = require('node:child_process')

function resolve (module, resolver = require) {
  try {
    return resolver(module)
  } catch {
    return null
  }
}

function run (electron) {
  if (typeof electron !== 'string') {
    console.error(`
      Cannot find 'electron' and $ELECTRON_PATH is not set.
      Either set $ELECTRON_PATH or run 'npm install electron'.`)

    process.exit(1)
  } else {
    let args = [
      join(__dirname, '..'),
      ...process.argv.slice(2)
    ]

    if (process.argv.includes('--coverage') && !process.env.NODE_V8_COVERAGE) {
      let { mkdtempSync } = require('node:fs')
      let { tmpdir } = require('node:os')

      process.env.NODE_V8_COVERAGE =
        mkdtempSync(join(tmpdir(), 'spark-coverage-'))
    }

    let child = spawn(electron, args)

    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)

    child.on('exit', (code, signal) => {
      if (signal)
        process.kill(process.pid, signal)
      else
        process.exit(code)
    })

    process.on('SIGINT', () => {
      child.kill('SIGINT')
      child.kill('SIGTERM')
    })
  }
}

run(process.env.ELECTRON_PATH || resolve('electron'))
