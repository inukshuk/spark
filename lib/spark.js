import { globSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { resolve } from 'node:path'
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
    streams.push(...run.runRenderer({ ...opts, ...renderer }))

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
  preload = config.preload,
  timeout = config.timeout,
  ui = config.ui,
  ...opts
} = {}) {
  let stream = createTestRunner({
    execArgv,
    isolation,
    preload,
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
  preload = config.preload,
  isolation = config.isolation,
  concurrency = config.concurrency,
  only,
  show = config.window.show,
  testNamePatterns = config.testNamePatterns,
  testSkipPatterns = config.testSkipPatterns,
  timeout = config.timeout,
  ui = config.ui,
  ...opts
}) {
  let args = {
    only, preload, testNamePatterns, testSkipPatterns, timeout, ui
  }

  let units = (isolation !== 'none' && !show)
    ? resolveFiles({ files, globPatterns }).map(f => ({ files: [f], ...args }))
    : [{ files, globPatterns, ...args }]

  if (!units.length)
    return []

  let streams = units.map(() =>
    new PassThrough({ objectMode: true }))

  let windows = workforce(units.length, concurrency, () =>
    new TestWindow({ show, ...opts }))

  drain(units, windows, (win, unit, i) =>
    TestSession
      .run(win, streams[i], unit, opts)
      .finally(() => {
        streams[i].end()
      })
  ).finally(() => {
    for (let w of windows) w.close()
  })

  return streams
}

function workforce (size, limit, factory) {
  if (limit === true)
    limit = availableParallelism() - 1
  if (limit === false)
    limit = 1
  else
    limit ??= size

  return Array.from({ length: Math.min(size, limit) }, factory)
}

function resolveFiles ({ files, globPatterns }) {
  if (files)
    return files.map(f => resolve(f))
  if (globPatterns)
    return globPatterns
      .flatMap(p => globSync(p, { cwd: process.cwd() }))
      .map(f => resolve(f))
  else
    return []
}

async function drain (items, workers, work) {
  let idx = 0
  await Promise.all(workers.map(async (worker) => {
    while (idx < items.length) {
      let i = idx++
      await work(worker, items[i], i)
    }
  }))
}
