import assert from 'node:assert/strict'
import process from 'node:process'
import tests from 'node:test'

// Test runner without isolation relies on event-loop to drain,
// which does not happen in Electron processes.
// Emitting beforeExit tricks TestsStream to terminate.
// See https://github.com/nodejs/node/issues/57234
function emitBeforeExit (stream) {
  let pending = 0

  stream
    .on('test:enqueue', () => {
      ++pending
    })
    .on('test:complete', () => {
      if (--pending === 0)
        process.emit('beforeExit')
    })
}

export function createTestRunner ({
  coverage = false,
  isolation = 'none',
  rerunFailuresFilePath,
  setup,
  watch = false,
  ...opts
} = {}) {
  assert.equal(isolation, 'none',
    'Test isolation not supported in Electron')

  // Limitations tests.run() when isolation is 'none':
  // - testNamePatterns, testSkipPatterns, only
  // - concurrency
  // - watch
  // - coverage
  // See https://github.com/nodejs/node/issues/57399

  assert(!coverage,
    'Test coverage not supported without isolation')
  assert(!watch,
    'Test watch option not supported without isolation')

  if (rerunFailuresFilePath)
    rerunFailuresFilePath = `${rerunFailuresFilePath}.${process.type}`

  return tests.run({
    ...opts,
    coverage,
    isolation,
    rerunFailuresFilePath,
    setup (stream) {
      emitBeforeExit(stream)
      setup?.(stream)
    },
    watch
  })
}
