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

function spark (args, opts) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [bin, ...sandbox, ...args], opts, (err, stdout, stderr) => {
      if (err && !err.code) return reject(err)
      resolve({ code: err?.code ?? 0, stdout, stderr })
    })
  })
}

test('--version', async () => {
  let { code, stdout } = await spark(['--version'])
  assert.equal(code, 0)
  assert.match(stdout.trim(), new RegExp(`^${version} \\(.+\\)$`))
})

test('--help', async () => {
  let { code, stdout } = await spark(['--help'])
  assert.equal(code, 0)
  assert.match(stdout, /Usage: spark/)
})

test('--verbose', async () => {
  let { code, stderr } = await spark(['--verbose', F.test('cli')])
  assert.equal(code, 0)
  assert.match(stderr, /spark-/)
})

test('--name-pattern', async () => {
  let { code, stdout } = await spark([
    '-i', 'process',
    '-R', 'tap',
    '-O', 'stdout',
    '-g', 'ionize',
    F.test('cli')
  ])
  assert.equal(code, 0)
  assert.match(stdout, /ok 1 - ionize/)
  assert.doesNotMatch(stdout, /detect/)
  assert.doesNotMatch(stdout, /discharge/)
})

test('--skip-pattern', async () => {
  let { code, stdout } = await spark([
    '-i', 'process',
    '-R', 'tap',
    '-O', 'stdout',
    '-x', 'discharge',
    F.test('cli')
  ])
  assert.equal(code, 0)
  assert.match(stdout, /ok 1 - ionize/)
  assert.match(stdout, /ok 2 - detect/)
  assert.doesNotMatch(stdout, /ok.*discharge/)
})

test('--only', async () => {
  let { code, stdout } = await spark([
    '-i', 'process',
    '-R', 'tap',
    '-O', 'stdout',
    '--only',
    F.test('only')
  ])
  assert.equal(code, 0)
  assert.match(stdout, /ok 1 - executed/)
  assert.doesNotMatch(stdout, /ok.*skipped/)
})

test('--ui', async (t) => {
  await t.test('bdd', async () => {
    let { code, stdout } = await spark([
      '--ui', 'bdd', '-R', 'tap', '-O', 'stdout', F.test('bdd')
    ])
    assert.equal(code, 0)
    assert.match(stdout, /ok 1 - works/)
    assert.match(stdout, /ok 2 - alias/)
    assert.match(stdout, /ok 1 - also works/)
  })

  await t.test('tdd', async () => {
    let { code, stdout } = await spark([
      '--ui', 'tdd', '-R', 'tap', '-O', 'stdout', F.test('tdd')
    ])
    assert.equal(code, 0)
    assert.match(stdout, /ok 1 - works/)
  })
})

test('--global-setup', async (t) => {
  await t.test('runs setup and teardown', async () => {
    let { code, stdout } = await spark([
      '-S', F.js('setup'),
      '-R', 'tap',
      '-O', 'stdout',
      F.test('setup')
    ])

    assert.equal(code, 0)
    assert.match(stdout, /ok 1 - global setup ran before tests/)
    assert.match(stdout, /ok 2 - module imported before app ready/)
    assert.match(stdout, /SPARK_TEARDOWN/)
  })

  await t.test('setup failure skips tests and teardown', async () => {
    let { code, stdout, stderr } = await spark([
      '-S', F.js('setup-fail'),
      '-R', 'tap',
      '-O', 'stdout',
      F.test('cli')
    ])

    assert.equal(code, 1)
    assert.match(stderr, /setup failed/)
    assert.doesNotMatch(stdout, /ok/)
    assert.doesNotMatch(stdout, /SPARK_TEARDOWN/)
  })

  await t.test('bad module path', async () => {
    let { code, stderr } = await spark([
      '-S', 'nonexistent.js',
      F.test('cli')
    ])

    assert.equal(code, 1)
    assert.match(stderr, /ERROR/)
  })
})
