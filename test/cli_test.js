import assert from 'node:assert'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { test } from 'node:test'
import { pkg } from '../lib/args.js'

let bin = join(import.meta.dirname, '../bin/spark.cjs')

function spark (args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, (err, stdout, stderr) => {
      if (err && !err.code) return reject(err)
      resolve({ code: err?.code ?? 0, stdout, stderr })
    })
  })
}

test('--version', async () => {
  let { code, stdout } = await spark(['--version'])
  let { version } = pkg()
  assert.equal(code, 0)
  assert.match(stdout.trim(), new RegExp(`^${version} \\(.+\\)$`))
})
