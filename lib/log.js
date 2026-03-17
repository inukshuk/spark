import { styleText } from 'node:util'
import config from './config.js'

export default function log (level, ...args) {
  log[level ?? 'info']?.(...args)
}

export function debug (...args) {
  if (config.verbose)
    console.debug(styleText('gray', args.shift()), ...args)
}

export function info (...args) {
  console.info(...args)
}

export function warn (...args) {
  console.warn(styleText('yellow', args.shift()), ...args)
}

export function error (...args) {
  let first = args.shift()

  if (first instanceof Error) {
    console.error(styleText('red', first.message), ...args)
    console.error(styleText('gray', first.stack))
  } else {
    console.error(styleText('red', first), ...args)
  }
}

Object.assign(log, { debug, info, warn, error })
