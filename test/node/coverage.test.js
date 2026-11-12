import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import process from 'node:process'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { F } from '../support/fixtures.js'
import { sparkBin } from '../support/process.js'

const exec = promisify(execFile)

const files = F.join('compile/badge.test.js')
const hooks = F.join('compile/hooks.js')
const reporter = F.join('compile/reporter.js')

// Otherwise the nested node --test reports as a child of this one.
const { NODE_TEST_CONTEXT, ...env } = process.env

for (let sourceMaps of [true, false]) {
  test(`renderer coverage of compiled files matches node --test (sourceMaps: ${sourceMaps})`, async () => {
    let flags = sourceMaps ? ['--enable-source-maps'] : []

    let node = await exec(process.execPath, [
      ...flags,
      '--test',
      '--experimental-test-coverage',
      // URLs, because Windows paths are not valid specifiers here.
      '--import', pathToFileURL(hooks).href,
      '--test-reporter', pathToFileURL(reporter).href,
      files
    ], { env })

    let spark = await sparkBin([
      '--coverage',
      '--preload', hooks,
      '-R', reporter,
      '-r', files
    ], { env: { ...env, NODE_OPTIONS: flags.join(' ') } })

    assert.equal(spark.code, 0, spark.stderr)

    let expected = JSON.parse(node.stdout)
    assert.equal(expected.length, 1)
    assert.deepEqual(JSON.parse(spark.stdout), expected)
  })
}
