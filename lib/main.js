import process from 'node:process'
import v8 from 'node:v8'
import { app } from 'electron'
import init from './init.js'
import setup from './setup.js'
import config, { configure } from './config.js'
import { verbose, info, error } from './log.js'
import { parse, usage } from './args.js'
import { run } from './spark.js'
import { report, tap } from './stream.js'

{
  process.env.NODE_ENV ??= 'test'

  process
    .on('uncaughtException', fail)
    .on('unhandledRejection', fail)

  init()
  configure(process.cwd())

  let opts = parse()
  if (opts.verbose != null)
    config.verbose = opts.verbose

  if (opts.help) {
    info(usage())
    quit(0)
  }

  if (opts.version) {
    info(`${app.getVersion()} (${process.versions.electron})`)
    quit(0)
  }

  verbose(`spark:main using ${app.getPath('appData')}`)
  setup(opts, async ({ reporters }) => {
    let [summary] = await report(
      run(opts),
      reporters,
      tap('test:summary'))

    quit(process.exitCode || (summary.success ? 0 : 1))
  }).catch(err => {
    error(err)
    quit(1)
  })
}

function fail (err) {
  // Defer to listeners added later, e.g. by the node:test harness.
  if (process.listeners('uncaughtException').at(-1) !== fail) return

  error(err)
  quit(1)
}

function quit (code) {
  v8.takeCoverage()

  if (!app.isReady())
    return app.exit(code)

  app.once('will-quit', () => app.exit(code))
  app.quit()

  // In case quitting is prevented, e.g. by a beforeunload handler.
  setTimeout(() => app.exit(code), 5000)
}
