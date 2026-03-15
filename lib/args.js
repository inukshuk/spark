import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as reporters from 'node:test/reporters'
import { parseArgs } from 'node:util'

export function parse () {
  let { values, positionals } = parseArgs({
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
      renderer: {
        type: 'string',
        short: 'r',
        multiple: true
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
    allowPositionals: true
  })

  if (values.version)
    values.version = pkg().version

  if (positionals.length)
    values.main = positionals

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

export const usage = () => `Usage: spark [options] [globs...]

Options:
  -r, --renderer <glob>     glob patterns for renderer tests (repeatable)
  -R, --reporter <name>     test reporter name or path (repeatable, default: spec)
  -O, --destination <path>  output destination per reporter (repeatable, default: stdout)
  -V, --verbose             verbose output
  -h, --help                show this help
  -v, --version             show version
`

export const pkg = () => JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../package.json'), {
      encoding: 'utf-8'
    }))
