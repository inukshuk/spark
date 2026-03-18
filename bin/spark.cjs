#!/usr/bin/env node

'use strict'

const console = require('node:console')
const process = require('node:process')
const { join } = require('node:path')
const { spawn } = require('node:child_process')

if (process.versions.electron) {
  throw new Error(`
    bin/spark.cjs is a Node.js CLI trampoline.
    To launch spark in Electron run 'electron spark' instead.`)
}

function resolve (module, resolver = require) {
  try {
    return resolver(module)
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND')
      return null

    console.error(e.message)
    process.exit(1)
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

    let child = spawn(electron, args, { stdio: 'inherit' })

    child.on('error', (e) => {
      console.error(e.message)
      process.exit(1)
    })

    child.on('exit', (code, signal) => {
      if (signal)
        process.kill(process.pid, signal)
      else
        process.exit(code)
    })

    process.on('SIGINT', () => child.kill('SIGINT'))
    process.on('SIGTERM', () => child.kill('SIGTERM'))
  }
}

run(process.env.ELECTRON_PATH || resolve('electron'))
