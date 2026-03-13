import process from 'node:process'
import { join } from 'node:path'
import { styleText } from 'node:util'
import { finished } from 'node:stream/promises'
import { PassThrough } from 'node:stream'
import { app, BrowserWindow, ipcMain } from 'electron'
import { parse, usage } from './args.js'

import * as reporters from 'node:test/reporters'
import { run } from './run.js'

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

} catch (e) {
  console.error(usage())
  console.error(`${styleText('red', 'ERROR:')} ${e.message}`)
  console.error(styleText('gray', e.stack))
  app.exit(1)
}

async function runTests (opts) {
  let combined = new PassThrough({ objectMode: true })
  let summaries = []
  let coverages = []
  let diagnostics = {}
  let planCount = 0
  let remaining = 2

  function forward (event) {
    let { type, data } = event
    if (type === 'test:summary') {
      summaries.push(data)
      return
    }
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

  function done () {
    if (--remaining > 0) return
    combined.push({ type: 'test:plan', data: { nesting: 0, count: planCount } })
    for (let [key, val] of Object.entries(diagnostics))
      combined.push({ type: 'test:diagnostic', data: { nesting: 0, message: `${key} ${val}` } })
    for (let c of coverages) combined.push(c)
    combined.push({ type: 'test:summary', data: mergeSummaries(summaries) })
    combined.end()
  }

  runMain(forward, done)
  runRenderer(forward, done)

  combined
    .compose(reporters.spec)
    .pipe(process.stdout)

  await finished(combined)

  app.exit(summaries.reduce((n, s) => n + s.counts.failed, 0))
}

function runMain (forward, done) {
  let source = run({
    globPatterns: [
      'test/main/process_test.js',
    ],
  })

  source.on('data', forward)
  source.on('end', done)
}

function runRenderer (forward, done) {
  let win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, './preload.cjs'),
      sandbox: false
    }
  })

  ipcMain.on('test:event', (e, event) => { forward(event) })
  ipcMain.on('test:done', () => { win.close(); done() })

  win.webContents.on('console-message', (e) => {
    process[e.level <= 1 ? 'stdout' : 'stderr'].write(e.message + '\n')
  })

  win.loadURL('about:blank')
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
