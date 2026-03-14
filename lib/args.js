import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
      renderer: {
        type: 'string',
        short: 'r',
        multiple: true
      },
    },
    allowPositionals: true
  })

  if (values.version)
    values.version = pkg().version

  if (positionals.length)
    values.main = positionals

  return values
}

export const usage = () => `Usage: spark [options] [globs...]

Options:
  -r, --renderer <glob>  glob patterns for renderer tests (repeatable)
  -h, --help             show this help
  -v, --version          show version
`

export const pkg = () => JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../package.json'), {
      encoding: 'utf-8'
    }))
