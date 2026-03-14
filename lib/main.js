import process from 'node:process'
import { join } from 'node:path'
import { styleText } from 'node:util'
import { finished } from 'node:stream/promises'
import { PassThrough } from 'node:stream'
import { app, BrowserWindow } from 'electron'
import { parse, usage } from './args.js'

import * as reporters from 'node:test/reporters'
import { run } from './run.js'

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

  let summaries = await Promise.all([
    runMain({ forward, globPatterns: ['test/main/**/*_test.js'] }),
    runRenderer({ forward, globPatterns: ['test/renderer/**/*_test.js'] }),
  ])

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

function runMain ({ forward, ...opts } = {}) {
  return new Promise((resolve, reject) => {
    let summary
    run({
      ...opts,
      setup (stream) {
        stream
          .on('data', (event) => {
            if (event.type === 'test:summary')
              summary = event.data
            else
              forward?.(event)
          })
          .on('end', () => resolve(summary))
          .on('error', reject)
      }
    })
  })
}

function runRenderer ({ forward, ...opts } = {}) {
  return new Promise((resolve, reject) => {
    let summary
    let win = new BrowserWindow({
      show: false,
      webPreferences: {
        additionalArguments: [
          `--spark=${JSON.stringify(opts)}`,
        ],
        preload: join(import.meta.dirname, './preload.cjs'),
        sandbox: false
      }
    })

    win.webContents.ipc
      .on('spark:event', (_, event) => {
        if (event.type === 'test:summary')
          summary = event.data
        else
          forward?.(event)
      })
      .on('spark:done', () => {
        win.close()
        resolve(summary)
      })

    win.webContents
      .on('render-process-gone', (_, details) => {
        reject(new Error(`Renderer process gone: ${details.reason}`))
      })
      .on('console-message', (e) => {
        process[e.level <= 1 ? 'stdout' : 'stderr'].write(`${e.message}\n`)
      })

    win.loadURL('about:blank')
  })
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
