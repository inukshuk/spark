import assert from 'node:assert'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

let bin = join(import.meta.dirname, '../bin/spark.cjs')
let { version } = JSON.parse(
  readFileSync(join(import.meta.dirname, '../package.json'), 'utf-8')
)

function spark (args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, (err, stdout, stderr) => {
      if (err && !err.code) return reject(err)
      resolve({ code: err?.code ?? 0, stdout, stderr })
    })
  })
}

let fixture = 'test/fixtures/cli_test.js'

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
  let { code, stderr } = await spark(['--verbose', fixture])
  assert.equal(code, 0)
  assert.match(stderr, /spark-/)
})

// --only, --name-pattern, and --skip-pattern are not testable
// until nodejs/node#57399 is resolved (isolation: 'none')
