import test from 'node:test'

test('before crash', () => {})

test('crash', () => {
  process.exit(1)
})
