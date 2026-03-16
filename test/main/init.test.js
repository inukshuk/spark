import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { app } from 'electron'

test('app name', () => {
  assert.equal(app.getName(), 'spark')
})

test('app paths are in tmp dir', () => {
  let tmp = tmpdir()

  for (let name of [
    'appData',
    'userData',
    'sessionData',
    'cache',
    'logs',
    'crashDumps'
  ]) {
    assert(
      app.getPath(name).startsWith(tmp),
      `${name} should be in tmp`
    )
  }
})
