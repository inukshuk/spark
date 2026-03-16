import assert from 'node:assert/strict'
import { join } from 'node:path'
import process from 'node:process'
import tests from 'node:test'

const FORCE_EXIT = join(import.meta.dirname, 'force-exit.cjs')

// Electron doesn't parse Node test flags from argv.
// Build NODE_OPTIONS to forward them to child processes.
function nodeOptions ({
  env,
  only,
  testNamePatterns,
  testSkipPatterns,
  timeout
}) {
  let flags = []

  if (testNamePatterns)
    for (let p of testNamePatterns)
      flags.push(`--test-name-pattern=${p}`)

  if (testSkipPatterns)
    for (let p of testSkipPatterns)
      flags.push(`--test-skip-pattern=${p}`)

  if (only)
    flags.push('--test-only')

  if (timeout != null)
    flags.push(`--test-timeout=${timeout}`)

  if (!flags.length)
    return env
  else
    return {
      ...env ?? process.env,
      NODE_OPTIONS: [
        env?.NODE_OPTIONS ?? process.env.NODE_OPTIONS ?? '',
        ...flags
      ].filter(Boolean).join(' ')
    }
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
  execArgv = [],
  isolation = 'none',
  rerunFailuresFilePath,
  setup,
  watch = false,
  ...opts
} = {}) {
  if (process.type === 'renderer') {
    assert.equal(isolation, 'none',
      'Test isolation not supported in renderer process')
  }

  if (isolation === 'none') {
    // For testNamePatterns, testSkipPatterns, only
    // See https://github.com/nodejs/node/issues/57399
    assert(!coverage,
      'Test coverage not supported without isolation')
    assert(!watch,
      'Test watch option not supported without isolation')
  }

  if (isolation === 'process') {
    execArgv = ['--require', FORCE_EXIT, ...execArgv]
    opts.env = nodeOptions(opts)
  }

  if (rerunFailuresFilePath)
    rerunFailuresFilePath = `${rerunFailuresFilePath}.${process.type}`

  return tests.run({
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
