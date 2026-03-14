import process from 'node:process'
import { styleText } from 'node:util'
import { finished } from 'node:stream/promises'
import { app } from 'electron'
import { parse, usage } from './args.js'
import { runMain, runRenderer } from './spark.js'
import { combine } from './combine.js'

import * as reporters from 'node:test/reporters'

function fail (err) {
  console.error(`${styleText('red', 'ERROR:')} ${err.message}`)
  console.error(styleText('gray', err.stack))
  app.exit(1)
}

try {
  let opts = parse()

  if (opts.help) {
    console.log(usage())
    app.exit(0)
  }

  if (opts.version) {
    console.log(`${opts.version} (${process.versions.electron})`)
    app.exit(0)
  }

  app
    .whenReady()
    .then(() => runTests(opts))
    .catch(fail)

} catch (e) {
  console.error(usage())
  fail(e)
}

async function runTests (opts) {
  let streams = []

  if (opts.main || !opts.renderer)
    streams.push(runMain({ globPatterns: opts.main }))

  if (opts.renderer) {
    streams.push(runRenderer({
      globPatterns: opts.renderer,
      onConsole: (e) => (console[e.level] ?? console.log)(e.message),
    }))
  }

  let combined = combine(streams)
  let failed = 0

  let report = combined
    .compose(async function * (source) {
      for await (let event of source) {
        if (event.type === 'test:summary') failed = event.data.counts.failed
        yield event
      }
    })
    .compose(reporters.spec)

  report.pipe(process.stdout)
  await finished(report)

  app.exit(failed)
}
