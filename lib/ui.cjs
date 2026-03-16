const process = require('node:process')
const {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  suite,
  test
} = require('node:test')

function bdd (target = globalThis) {
  Object.assign(target, {
    after,
    afterEach,
    before,
    beforeEach,
    context: describe,
    describe,
    it,
    specify: it
  })
}

function tdd (target = globalThis) {
  Object.assign(target, {
    suite,
    suiteSetup: before,
    suiteTeardown: after,
    setup: before,
    teardown: after,
    test
  })
}

function expose (name, target = globalThis) {
  switch (name) {
    case 'bdd': return bdd(target)
    case 'tdd': return tdd(target)
  }
}

module.exports = {
  expose,
  bdd,
  tdd
}

// Auto-assign as side-effect!
if (process.env.SPARK_UI)
  expose(process.env.SPARK_UI)
