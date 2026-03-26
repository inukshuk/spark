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
  if (!(err instanceof Error))
    return console.error(err, ...args)

  let code = `[${err.code ?? 'ERROR'}]`
  let [message, ...stack] = err.stack?.split('\n') ?? [err.message]

  console.error(`  ${styleText('red', code)}`)
  console.error(`  ${message}`)

  for (let frame of stack)
    console.error(`  ${styleText('dim', frame)}`)

  if (args.length)
    error(...args)
}
