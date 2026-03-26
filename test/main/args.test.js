import assert from 'node:assert/strict'
import { test } from 'node:test'
import { options, parse, usage } from '../../lib/args.js'

function argv (...args) {
  return parse(args)
}

test('defaults', () => {
  let opts = argv()
  assert.deepEqual(Object.keys(opts), [])
})

test('positionals set globPatterns', () => {
  let opts = argv('test/main/**', 'test/other/**')
  assert.deepEqual(opts.globPatterns, ['test/main/**', 'test/other/**'])
})

test('positional directory expands to glob', () => {
  let opts = argv('test/main')
  assert.deepEqual(opts.globPatterns, ['test/main/**/*.{cjs,js,mjs}'])
})

test('--main directory expands to glob', () => {
  let opts = argv('-m', 'test/main')
  assert.deepEqual(opts.mainGlobPatterns, ['test/main/**/*.{cjs,js,mjs}'])
})

test('--renderer directory expands to glob', () => {
  let opts = argv('-r', 'test/renderer')
  assert.deepEqual(opts.rendererGlobPatterns, ['test/renderer/**/*.{cjs,js,mjs}'])
})

test('--isolation', () => {
  assert.equal(argv('-i', 'process').isolation, 'process')
  assert.equal(argv('--isolation', 'none').isolation, 'none')
})

test('--concurrency is numeric', () => {
  assert.equal(argv('-c', '4').concurrency, 4)
})

test('--timeout is numeric', () => {
  assert.equal(argv('-t', '5000').timeout, 5000)
})

test('--name-pattern becomes testNamePatterns', () => {
  let opts = argv('-g', 'foo', '-g', 'bar')
  assert.deepEqual(opts.testNamePatterns, ['foo', 'bar'])
  assert.equal(opts['name-pattern'], undefined)
})

test('--skip-pattern becomes testSkipPatterns', () => {
  let opts = argv('-x', 'slow')
  assert.deepEqual(opts.testSkipPatterns, ['slow'])
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
  assert.deepEqual(opts.rendererGlobPatterns, ['test/renderer/**'])
})

test('--main', () => {
  let opts = argv('-m', 'test/main/**')
  assert.deepEqual(opts.mainGlobPatterns, ['test/main/**'])
})

test('unknown reporter throws', () => {
  assert.throws(
    () => argv('-R', 'nonexistent'),
    /Unknown reporter/
  )
})

test('usage documents all options', () => {
  let text = usage()
  for (let name of Object.keys(options)) {
    assert.match(text, new RegExp(`--${name}`))
  }
})

test('--ui', () => {
  assert.equal(argv('--ui', 'bdd').ui, 'bdd')
  assert.equal(argv('--ui', 'tdd').ui, 'tdd')
})

test('--global-setup becomes globalSetupPath', () => {
  let opts = argv('-S', 'setup.js')
  assert.equal(opts.globalSetupPath, 'setup.js')
  assert.equal(opts['global-setup'], undefined)
})

test('--preload resolves paths', () => {
  let opts = argv('--preload', 'setup.js', '--preload', 'other.js')
  assert.equal(opts.preload.length, 2)
  assert.match(opts.preload[0], /setup\.js$/)
  assert.match(opts.preload[1], /other\.js$/)
})

test('unknown flags collected in switches', () => {
  let opts = argv('--no-sandbox', '--unknown-flag')
  assert.deepEqual(opts.switches, ['--no-sandbox', '--unknown-flag'])
  assert.equal(opts.globPatterns, undefined)
})
