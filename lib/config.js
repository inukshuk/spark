import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalize } from './reporter.js'

const defaults = {
  coverageExcludeGlobs: undefined,
  coverageIncludeGlobs: undefined,
  reporters: [{ reporter: 'spec', destination: 'stdout' }],
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
    sandbox: false,
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

    Object.assign(into, config)
    Object.assign(into.window, window)
    Object.assign(into.webPreferences, webPreferences)
  } catch {
    // Ignore. Config load is best effort.
  }
}
