import { test } from 'node:test'

test('console', () => {
  console.log('in-test log')
  console.error('in-test error')
})

test('streams', () => {
  process.stdout.write('in-test stdout\n')
  process.stderr.write('in-test stderr\n')
})
