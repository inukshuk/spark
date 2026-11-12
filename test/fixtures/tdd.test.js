import assert from 'node:assert/strict'

suite('tdd', () => {
  let setups = 0

  suiteSetup(() => {})
  suiteTeardown(() => {})
  setup(() => { setups++ })
  teardown(() => {})

  test('works', () => {
    assert.equal(setups, 1)
  })

  test('runs setup before each test', () => {
    assert.equal(setups, 2)
  })
})
