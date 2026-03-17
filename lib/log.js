import { styleText } from 'node:util'
import config from './config.js'

export default function log (level, ...args) {
  log[level ?? 'info']?.(...args)
}

export function debug (...args) {
  if (config.verbose)
    console.error(styleText('gray', args.shift()), ...args)
}

export function info (...args) {
  console.log(...args)
}

export function warn (...args) {
  console.warn(styleText('yellow', `[WARN]: ${args.shift()}`), ...args)
}

export function error (err, ...args) {
  if (err instanceof Error) {
    console.error(styleText('red', `[ERROR]: ${err.message}`), ...args)
    console.error(styleText('gray', err.stack))
  } else {
    console.error(styleText('red', `[ERROR]: ${err}`), ...args)
  }
}

Object.assign(log, { debug, info, warn, error })
