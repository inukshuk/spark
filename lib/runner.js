import assert from 'node:assert/strict'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { expose } from './ui.cjs'

const FORCE_EXIT = join(import.meta.dirname, 'force-exit.cjs')
const UI = join(import.meta.dirname, 'ui.cjs')

// Electron doesn't parse Node test flags from argv.
// Build NODE_OPTIONS to forward them to child processes.
function nodeOptions ({
  only,
  testNamePatterns,
  testSkipPatterns,
  timeout
}) {
  let opts = []

  if (testNamePatterns)
    for (let p of testNamePatterns)
      opts.push(`--test-name-pattern=${p}`)

  if (testSkipPatterns)
    for (let p of testSkipPatterns)
      opts.push(`--test-skip-pattern=${p}`)

  if (only)
    opts.push('--test-only')

  if (timeout != null)
    opts.push(`--test-timeout=${timeout}`)

  return opts.join(' ')
}

// Tests with isolation: 'none' do not terminate
// because they wait for the beforeExit event.
// See https://github.com/nodejs/node/issues/57234
function emitBeforeExit (stream) {
  let pending = 0

  stream
    .on('test:enqueue', () => {
      ++pending
    })
    .on('test:complete', () => {
      if (--pending === 0)
        setImmediate(() => process.emit('beforeExit'))
    })
}

export function createTestRunner ({
  coverage = false,
  env = process.env,
  execArgv = [],
  isolation = 'none',
  rerunFailuresFilePath,
  setup,
  ui,
  watch = false,
  ...opts
} = {}) {
  if (process.type === 'renderer') {
    assert.equal(isolation, 'none',
      'Test isolation not supported in renderer process')
  }

  switch (isolation) {
    case 'none': {
      expose(ui)
      // For testNamePatterns, testSkipPatterns, only
      // See https://github.com/nodejs/node/issues/57399
      assert(!coverage,
        'Test coverage not supported without isolation')
      assert(!watch,
        'Test watch option not supported without isolation')
      break
    }
    case 'process': {
      execArgv = ['--require', FORCE_EXIT, ...execArgv]

      opts.env = {
        ...env,
        NODE_OPTIONS: [
          env.NODE_OPTIONS,
          nodeOptions(opts)
        ].filter(Boolean).join(' ')
      }

      if (ui) {
        execArgv.push('--require', UI)
        opts.env.SPARK_UI = ui
      }
      break
    }
  }

  if (rerunFailuresFilePath)
    rerunFailuresFilePath = `${rerunFailuresFilePath}.${process.type}`

  return test.run({
    ...opts,
    coverage,
    execArgv,
    isolation,
    rerunFailuresFilePath,
    setup (stream) {
      setup?.(stream)
      if (isolation === 'none')
        emitBeforeExit(stream)
    },
    watch
  })
}
