import assert from 'node:assert/strict'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { expose } from './ui.cjs'

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
  isolation = 'none',
  rerunFailuresFilePath,
  setup,
  watch = false,
  ...opts
} = {}) {
  switch (isolation) {
    case 'none': {
      assert(!watch,
        'Test watch option not supported without isolation')

      // Currently broken: testNamePatterns, testSkipPatterns, only
      // See https://github.com/nodejs/node/issues/57399
      expose(opts.ui)
      break
    }
    case 'process': {
      assert.equal(process.type, 'browser',
        'Test isolation only supported in main process')

      Object.assign(opts, childOpts(opts))
      break
    }
  }

  if (rerunFailuresFilePath)
    rerunFailuresFilePath = `${rerunFailuresFilePath}.${process.type}`

  return test.run({
    ...opts,
    coverage,
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

// Prepare execArgv and env for child processes spawned by test.run().
// Electron doesn't parse Node test flags from argv, so we forward them
// via NODE_OPTIONS. The env is a Proxy over process.env so that
// NODE_V8_COVERAGE (set later by test.run's coverage setup) is
// picked up at child-spawn time without mutating process.env.
function childOpts ({
  env = process.env,
  execArgv = [],
  only,
  testNamePatterns,
  testSkipPatterns,
  timeout,
  ui
}) {
  execArgv = [
    '--require',
    join(import.meta.dirname, 'child.cjs'),
    ...execArgv
  ]

  let overrides = {}

  let extra = []
  if (testNamePatterns)
    for (let p of testNamePatterns) extra.push(`--test-name-pattern=${p}`)
  if (testSkipPatterns)
    for (let p of testSkipPatterns) extra.push(`--test-skip-pattern=${p}`)
  if (only)
    extra.push('--test-only')
  if (timeout != null)
    extra.push(`--test-timeout=${timeout}`)

  if (extra.length)
    overrides.NODE_OPTIONS = [env.NODE_OPTIONS, ...extra].filter(Boolean).join(' ')

  if (ui)
    overrides.SPARK_UI = ui

  env = new Proxy(env, {
    get: (t, k) => overrides[k] ?? t[k],
    ownKeys: (t) => [...new Set([...Reflect.ownKeys(t), ...Object.keys(overrides)])],
    getOwnPropertyDescriptor: (t, k) => (
      (k in overrides || k in t)
        ? { value: overrides[k] ?? t[k], enumerable: true, configurable: true }
        : undefined
    )
  })

  return { execArgv, env }
}
