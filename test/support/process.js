import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import electron from 'electron'

export let root = join(import.meta.dirname, '../..')
export let bin = join(root, 'bin/spark.cjs')
export let { version } = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf-8')
)

let sandbox = process.platform === 'linux' ? ['--no-sandbox'] : []

export function spark (args, ...files) {
  if (typeof args === 'string')
    args = args.split(/\s+/)

  return new Promise((resolve, reject) => {
    execFile(electron, [
      root,
      ...sandbox,
      ...args,
      ...files
    ], (err, stdout, stderr) => {
      if (err && !err.code)
        return reject(err)
      else
        resolve({ code: err?.code ?? 0, stdout, stderr })
    })
  })
}

export function sparkBin (args) {
  if (typeof args === 'string')
    args = args.split(/\s+/)

  return new Promise((resolve, reject) => {
    execFile(process.execPath, [
      bin,
      ...sandbox,
      ...args
    ], (err, stdout, stderr) => {
      if (err && !err.code)
        return reject(err)
      else
        resolve({ code: err?.code ?? 0, stdout, stderr })
    })
  })
}
