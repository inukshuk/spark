import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import init from './init.js'
import config, { configure } from './config.js'
import { debug, info, error } from './log.js'
import { parse, usage } from './args.js'
import { resolveAll } from './reporter.js'
import { run } from './spark.js'
import { report, tap } from './stream.js'

{
  process
    .on('uncaughtException', fail)
    .on('unhandledRejection', fail)

  init()
  configure(process.cwd())

  let opts = parse()
  if (opts.verbose != null)
    config.verbose = opts.verbose

  if (opts.help)
    quit(usage())

  if (opts.version)
    quit(`${app.getVersion()} (${process.versions.electron})`)

  debug(`Using: ${app.getPath('appData')}`)

  delete process.env.NODE_TEST_CONTEXT
  let setup = maybeImport(opts.globalSetupPath)

  app
    .on('window-all-closed', () => {})
    .whenReady()
    .then(() => setup)
    .then(async ({ globalSetup, globalTeardown }) => {
      await globalSetup?.()
      try {
        return runTests(opts)
      } finally {
        await globalTeardown?.()
      }
    })
    .then(([summary]) => {
      app.exit(summary.counts.failed)
    })
}

async function runTests ({
  reporters = config.reporters,
  ...opts
}) {
  return report(
    run(opts),
    await resolveAll(reporters),
    tap('test:summary')
  )
}

function maybeImport (moduleName) {
  return moduleName
    ? import(pathToFileURL(resolve(moduleName)))
    : Promise.resolve({})
}

function quit (reason) {
  info(reason)
  app.exit(0)
}

function fail (err) {
  error(err)
  app.exit(1)
}
