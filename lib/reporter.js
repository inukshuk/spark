import { createWriteStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import * as reporters from 'node:test/reporters'
import { reporters as sparkReporters } from './reporters/index.js'

export function normalize (entry) {
  if (typeof entry === 'string')
    return { reporter: entry, destination: 'stdout' }
  if (Array.isArray(entry))
    return { reporter: entry[0], destination: entry[1] }
  return entry
}

export function validate (entries) {
  for (let { reporter } of entries) {
    if (!(reporter in sparkReporters) && !(reporter in reporters) && !existsSync(reporter))
      throw new Error(`Unknown reporter: ${reporter}`)
  }
}

export function resolveAll (entries) {
  return Promise.all(entries.map(async ({ reporter, destination }) => [
    await resolveReporter(reporter),
    resolveDestination(destination)
  ]))
}

function resolveReporter (name) {
  if (name in sparkReporters)
    return sparkReporters[name]
  return (name in reporters)
    ? reporters[name]
    : import(pathToFileURL(resolve(name))).then(m => m.default)
}

function resolveDestination (dest) {
  if (dest === 'stdout') return process.stdout
  if (dest === 'stderr') return process.stderr
  return createWriteStream(dest)
}
