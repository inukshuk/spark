import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import * as reporters from 'node:test/reporters'
import { app } from 'electron'
import './init.js'
import log, { debug, info, error } from './log.js'
import { parse, usage } from './args.js'
import { run } from './spark.js'
import { report, tap } from './stream.js'

{
  process
    .on('uncaughtException', fail)
    .on('unhandledRejection', fail)

  let opts = parse()

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
  reporter,
  destination,
  verbose,
  ...opts
}) {
  let source = run({
    ...opts,
    onConsole: verbose ? (e) => { log(e.level, e.message) } : null
  })

  return report(
    source,
    await resolveReporters(reporter, destination),
    tap('test:summary')
  )
}

function maybeImport (moduleName) {
  return moduleName
    ? import(pathToFileURL(resolve(moduleName)))
    : Promise.resolve({})
}

function resolveReporters (names, destinations) {
  return Promise.all(names.map(async (name, i) => [
    await resolveReporter(name),
    resolveDestination(destinations[i])
  ]))
}

function resolveReporter (name) {
  return (name in reporters)
    ? reporters[name]
    : import(pathToFileURL(resolve(name))).then(m => m.default)
}

function resolveDestination (dest) {
  if (dest === 'stdout') return process.stdout
  if (dest === 'stderr') return process.stderr
  return createWriteStream(dest)
}

function quit (reason) {
  info(reason)
  app.exit(0)
}

function fail (err) {
  error(err)
  app.exit(1)
}

