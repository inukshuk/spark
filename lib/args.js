import { existsSync } from 'node:fs'
import * as reporters from 'node:test/reporters'
import { parseArgs } from 'node:util'

export function parse (args) {
  let { values, positionals } = parseArgs({
    args,
    options: {
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
        short: 'V'
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
    },
    allowPositionals: true,
    strict: false
  })

  if (positionals.length)
    values.main = positionals

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

  values.reporter = values.reporter ?? ['spec']
  values.destination = values.destination ?? ['stdout']

  validateReporters(values.reporter, values.destination)

  return values
}

function validateReporters (names, destinations) {
  if (names.length !== destinations.length)
    throw new Error('Each --reporter must have a matching --destination')

  for (let name of names) {
    if (!(name in reporters) && !existsSync(name))
      throw new Error(`Unknown reporter: ${name}`)
  }
}

export const usage = () => `Usage: spark [options] [files...]

Arguments:
  files                        main process test files (glob patterns)

Options:
  -r, --renderer <files>       renderer test files (repeatable, glob)
  -g, --name-pattern <regex>   run matching tests (repeatable)
  -x, --skip-pattern <regex>   skip matching tests (repeatable)
  -c, --concurrency <n>        max concurrent test files
  -i, --isolation <mode>       test isolation (none, process)
  -t, --timeout <ms>           test timeout in ms
      --only                   run tests with { only: true }
      --rerun-failures <path>  rerun failures state file
  -R, --reporter <name>        reporter name or path (repeatable)
  -O, --destination <path>     output per reporter (repeatable)
      --no-sandbox             disable Chromium sandbox
  -V, --verbose                verbose output
  -h, --help                   show this help
  -v, --version                show version
`
