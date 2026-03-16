import assert from 'node:assert'
import { test } from 'node:test'
import { parse, usage } from '../../lib/args.js'

function argv (...args) {
  return parse(args)
}

test('defaults', () => {
  let opts = argv()
  assert.deepStrictEqual(opts.reporter, ['spec'])
  assert.deepStrictEqual(opts.destination, ['stdout'])
  assert.equal(opts.isolation, undefined)
  assert.equal(opts.main, undefined)
})

test('positionals set main globs', () => {
  let opts = argv('test/main/**', 'test/other/**')
  assert.deepStrictEqual(opts.main, ['test/main/**', 'test/other/**'])
})

test('--isolation', () => {
  assert.equal(argv('-i', 'process').isolation, 'process')
  assert.equal(argv('--isolation', 'none').isolation, 'none')
})

test('--concurrency is numeric', () => {
  assert.strictEqual(argv('-c', '4').concurrency, 4)
})

test('--timeout is numeric', () => {
  assert.strictEqual(argv('-t', '5000').timeout, 5000)
})

test('--name-pattern becomes testNamePatterns', () => {
  let opts = argv('-g', 'foo', '-g', 'bar')
  assert.deepStrictEqual(opts.testNamePatterns, ['foo', 'bar'])
  assert.equal(opts['name-pattern'], undefined)
})

test('--skip-pattern becomes testSkipPatterns', () => {
  let opts = argv('-x', 'slow')
  assert.deepStrictEqual(opts.testSkipPatterns, ['slow'])
  assert.equal(opts['skip-pattern'], undefined)
})

test('--rerun-failures becomes rerunFailuresFilePath', () => {
  let opts = argv('--rerun-failures', '.failures')
  assert.equal(opts.rerunFailuresFilePath, '.failures')
  assert.equal(opts['rerun-failures'], undefined)
})

test('--only', () => {
  assert.equal(argv('--only').only, true)
})

test('--renderer', () => {
  let opts = argv('-r', 'test/renderer/**')
  assert.deepStrictEqual(opts.renderer, ['test/renderer/**'])
})

test('reporter/destination mismatch throws', () => {
  assert.throws(
    () => argv('-R', 'spec', '-R', 'tap', '-O', 'stdout'),
    /must have a matching --destination/
  )
})

test('unknown reporter throws', () => {
  assert.throws(
    () => argv('-R', 'nonexistent', '-O', 'stdout'),
    /Unknown reporter/
  )
})

test('usage includes all flags', () => {
  let text = usage()
  for (let flag of [
    '--renderer', '--name-pattern', '--skip-pattern',
    '--concurrency', '--isolation', '--timeout', '--only',
    '--rerun-failures', '--reporter', '--destination',
    '--verbose', '--help', '--version'
  ]) {
    assert.match(text, new RegExp(flag))
  }
})

test('unknown flags are ignored', () => {
  let opts = argv('--no-sandbox', '--unknown-flag')
  assert.equal(opts.main, undefined)
})
