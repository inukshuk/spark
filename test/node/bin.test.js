import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { F } from '../support/fixtures.js'
import { bin, sparkBin, version } from '../support/process.js'

test('--version', () =>
  sparkBin('--version').then(({ code, stdout }) => {
    assert.equal(code, 0)
    assert.match(stdout.trim(), new RegExp(`^${version} \\(.+\\)$`))
  }))

test('forwards exit code', () =>
  sparkBin(`-S ${F.js('setup-fail')} ${F.test('cli')}`).then(({ code }) => {
    assert.equal(code, 1)
  }))

test('--coverage creates temp dir', {
  skip: process.env.NODE_V8_COVERAGE
}, async (t) => {
  let before = new Set(
    readdirSync(tmpdir()).filter(d => d.startsWith('spark-coverage-'))
  )

  await sparkBin('--coverage --version')

  let after = readdirSync(tmpdir()).filter(d => d.startsWith('spark-coverage-'))
  let created = after.find(d => !before.has(d))

  assert.ok(created, 'expected a spark-coverage-* directory in tmpdir')
  t.after(() => rmSync(join(tmpdir(), created), { recursive: true }))
})

test('bad ELECTRON_PATH', async () => {
  let { code, stderr } = await sparkBin('--version', {
    env: { PATH: process.env.PATH, ELECTRON_PATH: '/nonexistent' }
  })

  assert.equal(code, 1)
  assert.match(stderr, /ENOENT/)
})

test('missing electron', async (t) => {
  let dir = mkdtempSync(join(tmpdir(), 'spark-bin-'))
  t.after(() => rmSync(dir, { recursive: true }))
  copyFileSync(bin, join(dir, 'spark.cjs'))

  let { code, stderr } = await new Promise((resolve, reject) => {
    execFile(process.execPath, [join(dir, 'spark.cjs')], {
      env: { PATH: process.env.PATH }
    }, (err, stdout, stderr) => {
      if (err && !err.code) reject(err)
      else resolve({ code: err?.code ?? 0, stdout, stderr })
    })
  })

  assert.equal(code, 1)
  assert.match(stderr, /Cannot find 'electron'/)
})
