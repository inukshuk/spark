import { styleText } from 'node:util'
import config from './config.js'

export function verbose (...args) {
  if (config.verbose >= 1)
    console.error(styleText('dim', args.shift()), ...args)
}

export function debug (...args) {
  if (config.verbose >= 2)
    console.error(styleText('dim', args.shift()), ...args)
}

export function info (...args) {
  console.log(...args)
}

export function error (err, ...args) {
  if (err instanceof Error) {
    console.error(styleText('red', `[ERROR]: ${err.message}`), ...args)
    console.error(styleText('dim', err.stack))
  } else {
    console.error(styleText('red', `[ERROR]: ${err}`), ...args)
  }
}
