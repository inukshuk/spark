import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { configure } from '../../lib/config.js'
import { F } from '../support/fixtures.js'

const defaults = () => ({
  verbose: false,
  window: {},
  webPreferences: {}
})

describe('configure', () => {
  let into

  beforeEach(() => {
    into = defaults()
  })

  it('no package.json', () => {
    configure('/nonexistent/path', into)
    assert.deepEqual(into, defaults())
  })

  it('invalid package.json', () => {
    configure(F.join('config/bad'), into)
    assert.deepEqual(into, defaults())
  })

  it('no spark key', () => {
    configure(F.join('config/no-spark'), into)
    assert.deepEqual(into, defaults())
  })

  it('spark config', () => {
    configure(F.join('config/spark'), into)
    assert.equal(into.isolation, 'process')
    assert.equal(into.verbose, true)
    assert.equal(into.window.title, 'Custom Title')
    assert.equal(into.webPreferences.spellcheck, true)
    assert.deepEqual(into.reporters, [{ reporter: 'spec', destination: 'stdout' }])
  })
})
