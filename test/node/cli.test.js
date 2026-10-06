import assert from 'node:assert/strict'
import { readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { F } from '../support/fixtures.js'
import { spark, version } from '../support/process.js'

test('--version', () =>
  spark('--version').then(({ code, stdout }) => {
    assert.equal(code, 0)
    assert.match(stdout.trim(), new RegExp(`^${version} \\(.+\\)$`))
  }))

test('--help', () =>
  spark('--help').then(({ code, stdout }) => {
    assert.equal(code, 0)
    assert.match(stdout, /Usage: spark/)
  }))

test('--verbose', () =>
  spark('--verbose', F.test('cli'))
    .then(({ code, stderr }) => {
      assert.equal(code, 0)
      assert.match(stderr, /spark-/)
    }))

test('--name-pattern', () =>
  spark('-i process -R tap -g ionize', F.test('cli'))
    .then(({ code, stdout }) => {
      assert.equal(code, 0)
      assert.match(stdout, /ok 1 - ionize/)
      assert.doesNotMatch(stdout, /detect/)
      assert.doesNotMatch(stdout, /discharge/)
    }))

test('--skip-pattern', () =>
  spark('-i process -R tap -x discharge', F.test('cli'))
    .then(({ code, stdout }) => {
      assert.equal(code, 0)
      assert.match(stdout, /ok 1 - ionize/)
      assert.match(stdout, /ok 2 - detect/)
      assert.doesNotMatch(stdout, /ok.*discharge/)
    }))

test('--only', () =>
  spark('-i process -R tap --only', F.test('only'))
    .then(({ code, stdout }) => {
      assert.equal(code, 0)
      assert.match(stdout, /ok 1 - executed/)
      assert.doesNotMatch(stdout, /ok.*skipped/)
    }))

test('--ui', async (t) => {
  await t.test('bdd with process isolation', () =>
    spark('-i process --ui bdd -R tap', F.test('bdd'))
      .then(({ code, stdout }) => {
        assert.equal(code, 0)
        assert.match(stdout, /ok 1 - works/)
        assert.match(stdout, /ok 2 - alias/)
        assert.match(stdout, /ok 1 - also works/)
      }))

  await t.test('tdd with process isolation', () =>
    spark('-i process --ui tdd -R tap', F.test('tdd'))
      .then(({ code, stdout }) => {
        assert.equal(code, 0)
        assert.match(stdout, /ok 1 - works/)
      }))

  await t.test('bdd in main and renderer', () =>
    spark(`-r ${F.test('bdd')} --ui bdd -R tap ${F.test('bdd')}`)
      .then(({ code, stdout }) => {
        assert.equal(code, 0)
        assert.match(stdout, /# tests 6/)
      }))

  await t.test('tdd in main and renderer', () =>
    spark(`-r ${F.test('tdd')} --ui tdd -R tap ${F.test('tdd')}`)
      .then(({ code, stdout }) => {
        assert.equal(code, 0)
        assert.match(stdout, /# tests 2/)
      }))
})

test('--preload', async (t) => {
  let preloads = [
    F.join('preload.cjs'),
    F.js('preload')
  ].map(mod => `--preload ${mod}`).join(' ')

  function assertPreloaded ({ code, stdout }) {
    assert.equal(code, 0)
    assert.match(stdout, /ok 1 - esm preload ran/)
    assert.match(stdout, /ok 2 - cjs preload ran/)
  }

  await t.test('with process isolation', () =>
    spark(`-i process ${preloads} -R tap`, F.test('preload'))
      .then(assertPreloaded))

  await t.test('without isolation', () =>
    spark(`${preloads} -R tap`, F.test('preload'))
      .then(assertPreloaded))

  await t.test('in renderer', () =>
    spark(`-r ${F.test('preload')} ${preloads} -R tap`)
      .then(assertPreloaded))

  await t.test('bad module path', () =>
    spark(['--preload', 'nonexistent.js'], F.test('cli'))
      .then(({ code, stderr }) => {
        assert.ok(code > 0)
        assert.match(stderr, /Cannot find module/)
      }))
})

test('error handling', async (t) => {
  function assertErrorCode ({ code }) {
    assert.ok(code > 0)
  }

  await t.test('bad preload with isolation none', () =>
    spark(['--preload', 'nonexistent.js'], F.test('cli'))
      .then(assertErrorCode))

  await t.test('bad preload with process isolation', () =>
    spark(['-i', 'process', '--preload', 'nonexistent.js'], F.test('cli'))
      .then(assertErrorCode))

  await t.test('bad preload in renderer', () =>
    spark(['-r', F.test('cli'), '--preload', 'nonexistent.js'])
      .then(assertErrorCode))

  await t.test('throwing test with isolation none', () =>
    spark(F.test('throws'))
      .then(assertErrorCode))

  await t.test('throwing test with process isolation', () =>
    spark('-i process', F.test('throws'))
      .then(assertErrorCode))

  await t.test('throwing test in renderer', () =>
    spark(`-r ${F.test('throws')}`)
      .then(assertErrorCode))

  await t.test('unhandled rejection with isolation none', () =>
    spark(F.test('rejection'))
      .then(assertErrorCode))

  await t.test('unhandled rejection with process isolation', () =>
    spark('-i process', F.test('rejection'))
      .then(assertErrorCode))

  await t.test('unhandled rejection in renderer', () =>
    spark(`-r ${F.test('rejection')}`)
      .then(assertErrorCode))

  await t.test('renderer process crash', () =>
    spark(`-r ${F.test('crash')}`)
      .then(assertErrorCode))

  await t.test('file not found with isolation none', () =>
    spark('nonexistent.test.js')
      .then(assertErrorCode))

  await t.test('file not found with process isolation', () =>
    spark('-i process nonexistent.test.js')
      .then(assertErrorCode))

  await t.test('renderer file not found', () =>
    spark('-r nonexistent.test.js -R sparks')
      .then(({ code, stderr }) => {
        assert.ok(code > 0)
        assert.doesNotMatch(stderr, /TypeError/)
      }))

  await t.test('failing suite with isolation none', () =>
    spark(F.test('suite-throws'))
      .then(assertErrorCode))

  await t.test('failing suite with process isolation', () =>
    spark('-i process', F.test('suite-throws'))
      .then(assertErrorCode))

  await t.test('failing suite in renderer', () =>
    spark(`-r ${F.test('suite-throws')}`)
      .then(assertErrorCode))
})

test('console output', async (t) => {
  function assertRaw ({ code, stdout, stderr }) {
    assert.equal(code, 0)
    assert.match(stdout, /in-test log/)
    assert.match(stdout, /in-test stdout/)
    assert.match(stderr, /in-test error/)
    assert.match(stderr, /in-test stderr/)
  }

  function assertCaptured ({ code, stdout, stderr }) {
    assert.equal(code, 0)
    assert.match(stdout, /in-test log/)
    assert.match(stdout, /in-test error/)
    assert.match(stdout, /in-test stdout/)
    assert.match(stdout, /in-test stderr/)
    assert.doesNotMatch(stderr, /in-test/)
  }

  function assertHidden ({ code, stdout, stderr }) {
    assert.equal(code, 0)
    assert.doesNotMatch(stdout, /in-test/)
    assert.doesNotMatch(stderr, /in-test/)
  }

  await t.test('main isolation none', () =>
    spark('', F.test('console'))
      .then(assertRaw))

  await t.test('main isolation process', () =>
    spark('-i process', F.test('console'))
      .then(assertHidden))

  await t.test('renderer', () =>
    spark(`-r ${F.test('console')} -R sparks`)
      .then(assertHidden))

  await t.test('main isolation none --verbose', () =>
    spark('--verbose', F.test('console'))
      .then(assertRaw))

  await t.test('main isolation process --verbose', () =>
    spark('-i process --verbose', F.test('console'))
      .then(assertCaptured))

  await t.test('renderer --verbose', () =>
    spark(`-r ${F.test('console')} -R sparks --verbose`)
      .then(assertCaptured))
})

test('--global-setup', async (t) => {
  await t.test('runs setup and teardown', () =>
    spark(`-S ${F.js('setup')} -R tap ${F.test('setup')}`)
      .then(({ code, stdout }) => {
        assert.equal(code, 0)
        assert.match(stdout, /ok 1 - global setup ran before tests/)
        assert.match(stdout, /ok 2 - module imported before app ready/)
        assert.match(stdout, /SPARK_TEARDOWN/)
      }))

  await t.test('setup failure skips tests and teardown', () =>
    spark(`-S ${F.js('setup-fail')} -R tap ${F.test('cli')}`)
      .then(({ code, stdout, stderr }) => {
        assert.ok(code !== 0)
        assert.match(stderr, /setup failed/)
        assert.doesNotMatch(stdout, /ok/)
        assert.doesNotMatch(stdout, /SPARK_TEARDOWN/)
      }))

  await t.test('bad module path', () =>
    spark(['-S', 'nonexistent.js'], F.test('cli'))
      .then(({ code, stderr }) => {
        assert.ok(code !== 0)
        assert.match(stderr, /Error/i)
      }))
})

test('renderer isolation', async (t) => {
  let r = ['-r', F.test('isolation-a'), '-r', F.test('isolation-b')]

  await t.test('isolated files pass', () =>
    spark([...r, '-i', 'process', '-c', '2', '-R', 'tap'])
      .then(({ code, stdout }) => {
        assert.equal(code, 0)
        assert.match(stdout, /ok.*isolation a/)
        assert.match(stdout, /ok.*isolation b/)
      }))

  await t.test('sequential isolation reuses windows', () =>
    spark([...r, '-i', 'process', '-c', '1', '-R', 'tap'])
      .then(({ code, stdout }) => {
        assert.equal(code, 0)
        assert.match(stdout, /ok.*isolation a/)
        assert.match(stdout, /ok.*isolation b/)
      }))

  await t.test('without isolation second file fails', () =>
    spark([...r, '-R', 'tap'])
      .then(({ code, stdout }) => {
        assert.ok(code > 0)
        assert.match(stdout, /not ok.*isolation b/)
      }))
})

test('tap error details', async (t) => {
  function assertDetails ({ code, stdout }) {
    assert.ok(code > 0)
    assert.match(stdout, /^ {2}failureType: 'testCodeFailure'$/m)
    assert.match(stdout, /^ {2}error: \|-\n {4}Expected values to be strictly equal/m)
    assert.match(stdout, /^ {2}code: 'ERR_ASSERTION'$/m)
    assert.match(stdout, /^ {2}name: 'AssertionError'$/m)
    assert.match(stdout, /^ {2}expected: 2$/m)
    assert.match(stdout, /^ {2}actual: 1$/m)
    assert.match(stdout, /^ {2}operator: 'strictEqual'$/m)
    assert.match(stdout, /^ {2}stack: \|-\n {4}.*assertion\.test\.js:5/m)
    assert.doesNotMatch(stdout, /^ {2}(message|cause):/m)
  }

  await t.test('in main process', () =>
    spark('-R tap', F.test('assertion'))
      .then(assertDetails))

  await t.test('in renderer', () =>
    spark(`-r ${F.test('assertion')} -R tap`)
      .then(assertDetails))

  await t.test('renderer failure', () =>
    spark('-r nonexistent.test.js -R tap')
      .then(({ stdout }) => {
        assert.match(stdout, /^ {2}error: '\[\d+\]: exited/m)
        assert.doesNotMatch(stdout, /null:/)
      }))
})

test('--reporter with multiple destinations', async () => {
  let tmp = join(tmpdir(), `spark-test-${process.pid}.txt`)
  try {
    let { code, stdout, stderr } = await spark([
      '-R', 'tap', '-O', 'stdout',
      '-R', 'beam', '-O', 'stderr',
      '-R', 'sparks', '-O', tmp
    ], F.test('cli'))

    assert.equal(code, 0)
    assert.match(stdout, /ok 1/)
    assert.match(stderr, /ionize/)
    let file = readFileSync(tmp, 'utf8')
    assert.match(file, /3 pass/)
  } finally {
    try { unlinkSync(tmp) } catch {}
  }
})
