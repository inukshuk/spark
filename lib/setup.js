import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import config from './config.js'
import { debug } from './log.js'
import { resolveAll } from './reporter.js'

export default function setup ({
  globalSetupPath,
  reporters = config.reporters,
  show = config.show
}, fn) {
  // Import early before app-ready!
  let module = globalSetupPath
    ? import(pathToFileURL(resolve(globalSetupPath)))
    : Promise.resolve({})

  // Clear test-runner context so we can self-test with node --test
  delete process.env.NODE_TEST_CONTEXT

  // Do not exit on Linux/Windows
  app.on('window-all-closed', () => {})

  if (!show) {
    app.dock?.hide()
  }

  return app
    .whenReady()
    .then(() => module)
    .then(async ({ globalSetup, globalTeardown }) => {
      reporters = await resolveAll(reporters)

      debug('spark:setup')
      await globalSetup?.()

      try {
        return await fn({ reporters })
      } finally {
        debug('spark:teardown')
        await globalTeardown?.()
      }
    })
}
