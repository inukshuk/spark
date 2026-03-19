import { once } from 'node:events'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { app, BrowserWindow } from 'electron'
import config from './config.js'
import { debug } from './log.js'
import { startCoverage } from './coverage.js'
import { filterStdErr, combine } from './stream.js'
import { createTestRunner } from './runner.js'

const CHROMIUM_ERROR = /^\[\d+:\d+\/[\d.]+:\w+:/
const defaultExecArgv = app.commandLine.hasSwitch('no-sandbox') ? ['--no-sandbox'] : []

export function run ({
  switches,
  ...opts
} = {}) {
  if (switches?.length)
    opts.execArgv = [...(opts.execArgv ?? []), ...switches]

  let streams = []
  let { main, renderer } = route(opts)

  if (main || !renderer)
    streams.push(run.Main({ ...opts, ...main }))
  if (renderer)
    streams.push(run.Renderer({ ...opts, ...renderer }))

  return combine(streams)
}

run.Main = runMain
run.Renderer = runRenderer
export default run

function route ({
  files,
  globPatterns,
  mainFiles,
  mainGlobPatterns,
  rendererFiles,
  rendererGlobPatterns,
  show = config.window.show,
  url = config.url
}) {
  if (!(files || globPatterns || mainFiles ||
    mainGlobPatterns || rendererFiles || rendererGlobPatterns
  )) {
    ({
      files,
      globPatterns,
      mainFiles,
      mainGlobPatterns,
      rendererFiles,
      rendererGlobPatterns
    } = config)
  }

  if (show || url) {
    rendererGlobPatterns ??= globPatterns
    rendererFiles ??= files
  } else {
    mainGlobPatterns ??= globPatterns
    mainFiles ??= files
  }

  let main = (mainGlobPatterns || mainFiles)
    ? { globPatterns: mainGlobPatterns, files: mainFiles }
    : undefined

  let renderer = (rendererGlobPatterns || rendererFiles)
    ? { globPatterns: rendererGlobPatterns, files: rendererFiles }
    : undefined

  return { main, renderer }
}

export function runMain ({
  execArgv = defaultExecArgv,
  isolation = 'none',
  ...opts
} = {}) {
  let stream = createTestRunner({ execArgv, isolation, ...opts })

  if (isolation === 'process') {
    stream = stream.pipe(filterStdErr(CHROMIUM_ERROR))
  }

  return stream
}

export function runRenderer (opts = {}) {
  let out = new PassThrough({ objectMode: true })

  testRenderer({ out, ...opts })
    .then(() => out.end())
    .catch(err => {
      if (!out.destroyed) out.destroy(err)
    })

  return out
}

async function testRenderer ({
  concurrency,
  coverage,
  coverageExcludeGlobs = config.coverageExcludeGlobs,
  coverageIncludeGlobs = config.coverageIncludeGlobs,
  files,
  globPatterns,
  onConsole,
  only,
  out,
  show = config.window.show,
  testNamePatterns,
  testSkipPatterns,
  timeout,
  ui,
  url = 'spark://chamber'
} = {}) {
  let win = new BrowserWindow({
    show,
    webPreferences: {
      additionalArguments: [`--spark=${JSON.stringify({
        concurrency,
        files,
        globPatterns,
        only,
        testNamePatterns,
        testSkipPatterns,
        timeout,
        ui
      })}`],
      preload: join(import.meta.dirname, './preload.cjs'),
      sandbox: false,
      backgroundThrottling: false,
      disableDialogs: true,
      spellcheck: false
    }
  })

  try {
    let ac = new AbortController()
    let { signal } = ac
    let summary, coverageData
    let run = 0

    win.on('closed', () => {
      debug(`[${win.id}]: window closed`)
      ac.abort()
    })

    win.webContents
      .on('render-process-gone', (_, { exitCode, reason }) => {
        ac.abort(new Error(`Renderer process exited: (${exitCode}) ${reason}`))
      })
      .on('console-message', (details) => {
        onConsole?.(details)
      })

    win.webContents.ipc
      .on('spark:event', (_, event) => {
        if (event.type === 'test:summary') {
          summary = event
        } else {
          out?.write(event)
        }
      })

    debug(`[${win.id}]: loading ${url}`)
    win.loadURL(url)

    try {
      while (true) {
        let stopCoverage

        await Promise.all([
          once(win.webContents, 'dom-ready', { signal }),
          once(win.webContents.ipc, 'spark:ready', { signal })
        ])

        debug(`[${win.id}]: spark:ready`)

        if (run++ > 0)
          out?.write({ type: 'test:watch:restarted' })

        if (coverage || process.env.NODE_V8_COVERAGE)
          stopCoverage = await startCoverage(win.webContents, {
            coverageExcludeGlobs,
            coverageIncludeGlobs
          })

        debug(`[${win.id}]: spark:start`)
        win.webContents.send('spark:start')

        await once(win.webContents.ipc, 'spark:done', { signal })
        debug(`[${win.id}]: spark:done`)

        if (stopCoverage) {
          coverageData = await stopCoverage()
          if (coverage)
            out?.write({ type: 'test:coverage', data: coverageData })
        }

        if (summary) {
          out?.write(summary)
          summary = null
        }

        if (!show) break
      }
    } catch (err) {
      if (!show || err.code !== 'ABORT_ERR') throw err
    }

    return {
      summary: summary?.data,
      coverage: coverageData
    }
  } finally {
    if (!win.isDestroyed()) win.close()
  }
}
