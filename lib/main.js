import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { styleText } from 'node:util'
import * as reporters from 'node:test/reporters'
import { app } from 'electron'
import { init } from './init.js'
import { parse, usage } from './args.js'
import { run } from './spark.js'
import { report, tap } from './stream.js'

try {
  let opts = parse()

  if (opts.help)
    quit(usage())
  if (opts.version)
    quit(`${app.getVersion()} (${process.versions.electron})`)

  init(path => {
    if (opts.verbose) debug({ message: `Using: ${path}` })
  })

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
    .catch(fail)

} catch (e) {
  console.error(usage())
  fail(e)
}

async function runTests ({
  reporter,
  destination,
  verbose,
  ...opts
}) {
  let source = run({
    ...opts,
    onConsole: verbose ? debug : null
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
  console.log(reason)
  app.exit(0)
}

function fail (err) {
  console.error(`${styleText('red', 'ERROR:')} ${err.message}`)
  console.error(styleText('gray', err.stack))
  app.exit(1)
}

function debug (e) {
  console.error(styleText(color(e.level), e.message))
}

function color (level) {
  switch (level) {
    case 'error': return 'red'
    case 'warning': return 'yellow'
    default: return 'gray'
  }
}
