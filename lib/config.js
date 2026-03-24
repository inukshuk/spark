import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { normalize } from './reporter.js'

const defaults = {
  coverageExcludeGlobs: undefined,
  coverageIncludeGlobs: undefined,
  preload: undefined,
  reporters: [{ reporter: 'spec', destination: 'stdout' }],
  concurrency: undefined,
  files: undefined,
  isolation: 'none',
  globPatterns: undefined,
  mainFiles: undefined,
  mainGlobPatterns: undefined,
  rendererFiles: undefined,
  rendererGlobPatterns: undefined,
  url: undefined,
  verbose: false,
  window: {
    show: false,
    title: 'Spark Chamber'
  },
  webPreferences: {
    backgroundThrottling: false,
    disableDialogs: true,
    spellcheck: false
  }
}

export default defaults

export function configure (cwd, into = defaults) {
  try {
    let {
      window,
      webPreferences,
      reporters,
      ...config
    } = JSON.parse(
      readFileSync(join(cwd, 'package.json'), 'utf8')
    ).spark

    if (reporters)
      into.reporters = reporters.map(normalize)
    if (into.preload)
      into.preload = into.preload.map(p => resolve(cwd, p))

    Object.assign(into, config)
    Object.assign(into.window, window)
    Object.assign(into.webPreferences, webPreferences)
  } catch {
    // Ignore. Config load is best effort.
  }
}
