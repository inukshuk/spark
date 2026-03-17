import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { F } from './support.js'

let bin = join(import.meta.dirname, '../bin/spark.cjs')
let { version } = JSON.parse(
  readFileSync(join(import.meta.dirname, '../package.json'), 'utf-8')
)

let sandbox = process.platform === 'linux' ? ['--no-sandbox'] : []

function spark (args, ...files) {
  if (typeof args === 'string')
    args = args.split(/\s+/)

  return new Promise((resolve, reject) => {
    execFile(process.execPath, [
      bin,
      ...sandbox,
      ...args,
      ...files
    ], (err, stdout, stderr) => {
      if (err && !err.code)
        return reject(err)
      else
        resolve({ code: err?.code ?? 0, stdout, stderr })
    })
  })
}

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
        assert.equal(code, 1)
        assert.match(stderr, /setup failed/)
        assert.doesNotMatch(stdout, /ok/)
        assert.doesNotMatch(stdout, /SPARK_TEARDOWN/)
      }))

  await t.test('bad module path', () =>
    spark(['-S', 'nonexistent.js'], F.test('cli'))
      .then(({ code, stderr }) => {
        assert.equal(code, 1)
        assert.match(stderr, /ERROR/)
      }))
})
