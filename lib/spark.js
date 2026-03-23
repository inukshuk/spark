import { PassThrough } from 'node:stream'
import { app } from 'electron'
import config from './config.js'
import { filterStdErr, combine } from './stream.js'
import { createTestRunner } from './runner.js'
import TestSession from './session.js'
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

  TestSession
    .run(win, stream, args, opts)
    .then(() => {
      stream.end()
    })
    .catch(err => {
      if (!stream.destroyed) stream.destroy(err)
    })
    .finally(() => win.close())

  return stream
}
