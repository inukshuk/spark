import assert from 'node:assert/strict'
import process from 'node:process'
import tests from 'node:test'

// Node.js test-runner relies on event-loop to drain,
// which does not happen in Electron processes.
// Emitting beforeExit tricks TestsStream to terminate.
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
  coverage,
  isolation = 'none',
  rerunFailuresFilePath,
  setup,
  watch = false,
  ...opts
} = {}) {
  assert.equal(isolation, 'none',
    'Test isolation not supported in Electron')
  assert(!watch,
    'Test watch option not supported in Electron')

  if (rerunFailuresFilePath)
    rerunFailuresFilePath = `${rerunFailuresFilePath}.${process.type}`

  return tests.run({
    ...opts,
    coverage: false,
    isolation,
    rerunFailuresFilePath,
    setup (stream) {
      emitBeforeExit(stream)
      setup?.(stream)
    },
    watch: false
  })
}
