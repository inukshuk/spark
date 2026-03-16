const process = require('node:process')
const { after } = require('node:test')

// Because Electron's event loop does not drain,
// tests spawned with isolation: 'process' never exit.
// The after hook runs when all tests complete via root.run(),
// giving us a chance to force exit.
after(() => {
  setImmediate(() => process.exit())
})
