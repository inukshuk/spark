import assert from 'node:assert/strict'
import { test } from 'node:test'
import { F } from '../support/fixtures.js'
import { sparkBin, version } from '../support/process.js'

test('--version', () =>
  sparkBin('--version').then(({ code, stdout }) => {
    assert.equal(code, 0)
    assert.match(stdout.trim(), new RegExp(`^${version} \\(.+\\)$`))
  }))

test('forwards exit code', () =>
  sparkBin(`-S ${F.js('setup-fail')} ${F.test('cli')}`).then(({ code }) => {
    assert.equal(code, 1)
  }))
