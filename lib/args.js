import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

export function parse (argv) {
  let { values } = parseArgs({
    options: {
      help: {
        type: 'boolean',
        short: 'h'
      },
      version: {
        type: 'boolean',
        short: 'v'
      },
    }
  })

  if (values.version)
    values.version = pkg().version

  return values
}

export const usage = () => 'Usage: spark [options] [files]\n'

export const pkg = () => JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../package.json'), {
      encoding: 'utf-8'
    }))
