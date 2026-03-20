import process from 'node:process'
import { app } from 'electron'
import init from './init.js'
import setup from './setup.js'
import config, { configure } from './config.js'
import { debug, info, error } from './log.js'
import { parse, usage } from './args.js'
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

  debug(`spark:main using ${app.getPath('appData')}`)
  setup(opts, async ({ reporters }) => {
    let [summary] = await report(
      run(opts),
      reporters,
      tap('test:summary'))

    app.exit(summary.counts.failed)
  })
}

function quit (reason) {
  info(reason)
  app.exit(0)
}

function fail (err) {
  error(err)
  app.exit(1)
}
