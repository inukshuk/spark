import { once } from 'node:events'
import { join } from 'node:path'
import { env } from 'node:process'
import { PassThrough } from 'node:stream'
import { app, BrowserWindow } from 'electron'
import config from './config.js'
import log, { debug } from './log.js'
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
    streams.push(run.runMain({ ...opts, ...main }))
  if (renderer)
    streams.push(run.runRenderer({ ...opts, ...renderer }))

  return combine(streams)
}

run.runMain = runMain
run.runRenderer = runRenderer
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
  isolation = config.isolation,
  timeout = config.timeout,
  ui = config.ui,
  ...opts
} = {}) {
  let stream = createTestRunner({
    execArgv,
    isolation,
    timeout,
    ui,
    ...opts
  })

  if (isolation === 'process') {
    stream = stream.pipe(filterStdErr(CHROMIUM_ERROR))
  }

  return stream
}

export function runRenderer ({
  files,
  globPatterns,
<<<<<<< HEAD
=======
  preload,
  isolation = config.isolation,
>>>>>>> a83a973 (Add --preload option to import into test processes)
  only,
  show = config.window.show,
  testNamePatterns = config.testNamePatterns,
  testSkipPatterns = config.testSkipPatterns,
  timeout = config.timeout,
  ui = config.ui,
  webPreferences,
  ...opts
}) {
  let stream = new PassThrough({ objectMode: true })

  // TODO handle concurrency and isolation=process
  let window = new BrowserWindow({
    ...config.window,
    show,
    webPreferences: {
      ...config.webPreferences,
      ...webPreferences,
<<<<<<< HEAD
=======
      additionalArguments: [`--spark=${JSON.stringify({
        concurrency,
        files,
        globPatterns,
        preload,
        only,
        testNamePatterns,
        testSkipPatterns,
        timeout,
        ui
      })}`],
>>>>>>> a83a973 (Add --preload option to import into test processes)
      preload: join(import.meta.dirname, './preload.cjs')
    }
  })

  let args = {
    files,
    globPatterns,
    only,
    testNamePatterns,
    testSkipPatterns,
    timeout,
    ui
  }

  runTests(window, stream, args, { show, ...opts })
    .then(() => {
      stream.end()
    })
    .catch(err => {
      if (!stream.destroyed) stream.destroy(err)
    })
    .finally(() => {
      if (!window.isDestroyed()) window.close()
    })

  return stream
}

async function runTests (win, out, args, {
  coverage,
  coverageExcludeGlobs = config.coverageExcludeGlobs,
  coverageIncludeGlobs = config.coverageIncludeGlobs,
  show,
  url = 'spark://chamber',
  verbose = config.verbose
} = {}) {
  let summary, covData, stopCoverage
  let numRuns = 0
  let ac = new AbortController()
  let { signal } = ac

  win.on('closed', () => {
    debug(`[${win.id}]: closed`)
    ac.abort()
  })

  win.webContents
    .on('render-process-gone', (_, { exitCode, reason }) => {
      ac.abort(new Error(
        `[${win.id}]: exited (${exitCode}) ${reason}`
      ))
    })
    .on('console-message', ({ level, message }) => {
      if (verbose) log(level, message)
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
      summary = null
      covData = null
      stopCoverage = null

      await Promise.all([
        once(win.webContents, 'dom-ready', { signal }),
        once(win.webContents.ipc, 'spark:ready', { signal })
      ])

      debug(`[${win.id}]: spark:ready`)

      if (numRuns++ > 0)
        out?.write({ type: 'test:watch:restarted' })

      if (coverage || env.NODE_V8_COVERAGE)
        stopCoverage = await startCoverage(win.webContents, {
          coverageExcludeGlobs,
          coverageIncludeGlobs
        })

      debug(`[${win.id}]: spark:start`)
      win.webContents.send('spark:start', args)

      await once(win.webContents.ipc, 'spark:done', { signal })
      debug(`[${win.id}]: spark:done`)

      covData = await stopCoverage?.()

      if (coverage && covData)
        out?.write({ type: 'test:coverage', data: covData })
      if (summary)
        out?.write(summary)

      if (!show) break
    }
  } catch (err) {
    if (!show || err.name !== 'AbortError') throw err
  }
}
