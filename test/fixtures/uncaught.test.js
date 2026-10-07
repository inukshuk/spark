import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'

// Uncaught errors should be handled by the test runner
// and must not halt the main, child or renderer process.

// In Node, the error is rethrown on nextTick, after the test ended.
test('listener throws', () => {
  let target = new EventTarget()
  target.addEventListener('click', () => { throw new Error('boom') })
  target.dispatchEvent(new Event('click'))
})

// In the renderer, the error cannot be attributed to the test,
// because DOM timers are not tracked by async_hooks.
test('timer throws', async () => {
  setTimeout(() => { throw new Error('boom') })
  await delay(10)
})

test('runs after', () => delay(200))
