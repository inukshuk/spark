import assert from 'node:assert/strict'
import process from 'node:process'
import tests from 'node:test'

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

export function createTestRunner (opts = {}) {
  assert(opts.isolation == null || opts.isolation === 'none',
    'test.run.isolation not supported in Electron')
  assert(!opts.watch,
    'test.run.watch not supported in Electron')

  return tests.run({
    ...opts,
    isolation: 'none',
    setup (stream) {
      emitBeforeExit(stream)
      opts.setup?.(stream)
    },
    watch: false
  })
}
