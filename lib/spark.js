import { env } from 'node:process'
import { PassThrough } from 'node:stream'
import { app } from 'electron'
import config from './config.js'
import { debug } from './log.js'
import { startCoverage } from './coverage.js'
import { filterStdErr, combine } from './stream.js'
import { createTestRunner } from './runner.js'
import TestWindow from './window.js'

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
  preload,
  isolation = config.isolation,
  only,
  show = config.window.show,
  testNamePatterns = config.testNamePatterns,
  testSkipPatterns = config.testSkipPatterns,
  timeout = config.timeout,
  ui = config.ui,
  ...opts
}) {
  let stream = new PassThrough({ objectMode: true })

  // TODO handle concurrency and isolation=process
  let win = new TestWindow({ show, ...opts })

  let args = {
    files,
    globPatterns,
    only,
    preload,
    testNamePatterns,
    testSkipPatterns,
    timeout,
    ui
  }

  runTests(win, stream, args, { show, ...opts })
    .then(() => {
      stream.end()
    })
    .catch(err => {
      if (!stream.destroyed) stream.destroy(err)
    })
    .finally(() => win.close())

  return stream
}

async function runTests (win, out, args, {
  coverage,
  coverageExcludeGlobs = config.coverageExcludeGlobs,
  coverageIncludeGlobs = config.coverageIncludeGlobs,
  show,
  url = 'spark://chamber'
} = {}) {
  if (win.closed)
    throw win.signal.reason

  let summary

  let { signal, release } = win.acquire({
    'console-message' ({ level, message }) {
      out?.write({
        type: `test:${(level === 'info') ? 'stdout' : 'stderr'}`,
        data: { message: message + '\n' }
      })
    },
    'spark:event' (_, event) {
      if (event.type === 'test:summary')
        summary = event
      else
        out?.write(event)
    }
  })

  let covData, stopCoverage
  let numRuns = 0

  debug(`[${win.id}]: loading ${url}`)
  win.load(url)

  try {
    while (true) {
      summary = null
      covData = null
      stopCoverage = null

      await Promise.all([
        win.once('dom-ready', { signal }),
        win.once('spark:ready', { signal })
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
      win.send('spark:start', args)

      await win.once('spark:done', { signal })
      debug(`[${win.id}]: spark:done`)

      covData = await stopCoverage?.()

      if (coverage && covData)
        out?.write({ type: 'test:coverage', data: covData })
      if (summary)
        out?.write(summary)

      if (!show) break
    }
  } catch (err) {
    debug(err.message)
    let reason = signal.reason ?? err
    if (!show || reason.cause !== 'closed') throw reason
  } finally {
    release()
  }
}
