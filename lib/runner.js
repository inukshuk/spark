import assert from 'node:assert/strict'
import { join } from 'node:path'
import process from 'node:process'
import tests from 'node:test'

const FORCE_EXIT = join(import.meta.dirname, 'force-exit.cjs')

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

  if (isolation === 'process')
    execArgv = ['--require', FORCE_EXIT, ...execArgv]

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
