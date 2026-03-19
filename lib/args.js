import { parseArgs } from 'node:util'
import config, { configure } from './config.js'
import { validate } from './reporter.js'

export const options = {
  help: {
    type: 'boolean',
    short: 'h'
  },
  version: {
    type: 'boolean',
    short: 'v'
  },
  verbose: {
    type: 'boolean',
    short: 'V',
    default: config.verbose
  },
  concurrency: {
    type: 'string',
    short: 'c'
  },
  'name-pattern': {
    type: 'string',
    short: 'g',
    multiple: true
  },
  only: {
    type: 'boolean'
  },
  'rerun-failures': {
    type: 'string'
  },
  main: {
    type: 'string',
    short: 'm',
    multiple: true
  },
  renderer: {
    type: 'string',
    short: 'r',
    multiple: true
  },
  'skip-pattern': {
    type: 'string',
    short: 'x',
    multiple: true
  },
  isolation: {
    type: 'string',
    short: 'i'
  },
  timeout: {
    type: 'string',
    short: 't'
  },
  'global-setup': {
    type: 'string',
    short: 'S'
  },
  coverage: {
    type: 'boolean',
  },
  'coverage-exclude': {
    type: 'string',
    multiple: true
  },
  'coverage-include': {
    type: 'string',
    multiple: true
  },
  show: {
    type: 'boolean',
    default: config.window.show
  },
  ui: {
    type: 'string'
  },
  url: {
    type: 'string',
  },
  reporter: {
    type: 'string',
    short: 'R',
    multiple: true
  },
  destination: {
    type: 'string',
    short: 'O',
    multiple: true
  },
}

export function parse (args) {
  let { values, positionals, tokens } = parseArgs({
    args,
    options,
    tokens: true,
    allowPositionals: true,
    strict: false
  })

  // Subtle: assuming these are Electron/Chromium switches!
  values.switches = tokens
    .filter(t => t.kind === 'option' && !(t.name in options))
    .map(t => t.rawName)

  if (positionals.length)
    values.globPatterns = positionals

  if (values.main) {
    values.mainGlobPatterns = values.main
    delete values.main
  }

  if (values.renderer) {
    values.rendererGlobPatterns = values.renderer
    delete values.renderer
  }

  if (values.concurrency)
    values.concurrency = Number(values.concurrency)

  if (values.timeout)
    values.timeout = Number(values.timeout)

  if (values['name-pattern']) {
    values.testNamePatterns = values['name-pattern']
    delete values['name-pattern']
  }

  if (values['skip-pattern']) {
    values.testSkipPatterns = values['skip-pattern']
    delete values['skip-pattern']
  }

  if (values['rerun-failures']) {
    values.rerunFailuresFilePath = values['rerun-failures']
    delete values['rerun-failures']
  }

  if (values['global-setup']) {
    values.globalSetupPath = values['global-setup']
    delete values['global-setup']
  }

  if (values['coverage-exclude']) {
    values.coverageExcludeGlobs = values['coverage-exclude']
    delete values['coverage-exclude']
  }

  if (values['coverage-include']) {
    values.coverageIncludeGlobs = values['coverage-include']
    delete values['coverage-include']
  }

  if (values.reporter) {
    values.reporters = values.reporter.map((name, i) => ({
      reporter: name,
      destination: values.destination?.[i] ?? 'stdout'
    }))
  } else {
    values.reporters = config.reporters
  }
  delete values.reporter
  delete values.destination

  validate(values.reporters)
  configure(values)

  return values
}

export const usage = () => `Usage: spark [options] [files...]

Arguments:
  files                        test files (glob patterns, routed by context)

Options:
  -m, --main <files>           main process test files (repeatable, glob)
  -r, --renderer <files>       renderer test files (repeatable, glob)
  -g, --name-pattern <regex>   run matching tests (repeatable)
  -x, --skip-pattern <regex>   skip matching tests (repeatable)
  -c, --concurrency <n>        max concurrent test files
  -i, --isolation <mode>       test isolation (none, process)
  -t, --timeout <ms>           test timeout in ms
      --coverage               enable code coverage
      --coverage-exclude <glob> exclude from coverage (repeatable)
      --coverage-include <glob> include in coverage (repeatable)
      --show                   show renderer window (reload reruns)
      --ui <name>              test interface (bdd, tdd)
      --url <url>              renderer page URL
      --only                   run tests with { only: true }
  -S, --global-setup <path>    module to run before tests
      --rerun-failures <path>  rerun failures state file
  -R, --reporter <name>        reporter name or path (repeatable)
  -O, --destination <path>     output per reporter (repeatable)
      --no-sandbox             disable Chromium sandbox
  -V, --verbose                verbose output
  -h, --help                   show this help
  -v, --version                show version
`
