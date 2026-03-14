import process from 'node:process'
import { styleText } from 'node:util'
import { finished } from 'node:stream/promises'
import { PassThrough } from 'node:stream'
import { app } from 'electron'
import { parse, usage } from './args.js'
import { runMain, runRenderer } from './index.js'

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
  let combined = new PassThrough({ objectMode: true })
  let coverages = []
  let diagnostics = {}
  let planCount = 0

  function forward (event) {
    let { type, data } = event
    if (type === 'test:summary') return
    if (type === 'test:coverage') {
      coverages.push(event)
      return
    }
    if (data?.nesting === 0) {
      if (type === 'test:plan') {
        planCount += data.count
        return
      }
      if (type === 'test:diagnostic') {
        let [key, val] = data.message.split(' ')
        diagnostics[key] = (diagnostics[key] ?? 0) + Number(val)
        return
      }
    }
    combined.push(event)
  }

  let runners = []

  if (opts.main || !opts.renderer)
    runners.push(runMain({ forward, globPatterns: opts.main }))

  if (opts.renderer) {
    runners.push(runRenderer({
      forward,
      globPatterns: opts.renderer,
      onConsole: (e) => (console[e.level] ?? console.log)(e.message),
    }))
  }

  let summaries = await Promise.all(runners)

  combined.push({ type: 'test:plan', data: { nesting: 0, count: planCount } })
  for (let [key, val] of Object.entries(diagnostics))
    combined.push({ type: 'test:diagnostic', data: { nesting: 0, message: `${key} ${val}` } })
  for (let c of coverages) combined.push(c)
  combined.push({ type: 'test:summary', data: mergeSummaries(summaries) })
  combined.end()

  combined
    .compose(reporters.spec)
    .pipe(process.stdout)

  await finished(combined)

  app.exit(summaries.reduce((n, s) => n + s.counts.failed, 0))
}

function mergeSummaries (summaries) {
  let counts = {}
  for (let s of summaries) {
    for (let [key, val] of Object.entries(s.counts))
      counts[key] = (counts[key] ?? 0) + val
  }
  return {
    ...summaries[0],
    counts,
    success: summaries.every((s) => s.success)
  }
}
