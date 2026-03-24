import { setTimeout } from 'node:timers/promises'
import test from 'node:test'

test('before', () => {})

test('rejecter', () => {
  Promise.reject(new Error('unhandled rejection'))
})

test('after', async () => {
  await setTimeout(100)
})
