import process from 'node:process'
import tests from 'node:test'

function setup (stream) {
  let pending = 0

  stream.on('test:enqueue', () => { ++pending })
  stream.on('test:complete', () => {
    if (--pending === 0)
      process.emit('beforeExit')
  })
}

export function run (opts) {
  return tests.run({
    ...opts,
    isolation: 'none',
    setup,
    watch: false
  })
}
