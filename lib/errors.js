import { inspect } from 'node:util'

export function cloneError (err) {
  if (!err || typeof err !== 'object') return err

  let props = {}
  for (let [key, value] of Object.entries(err))
    props[key] = cloneable(value)

  return {
    ...props,
    message: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack,
    cause: cloneError(err.cause)
  }
}

export function reviveError (err) {
  if (!err || typeof err !== 'object') return err

  let { message, name, stack, cause, ...props } = err
  let error = new Error(message, cause === undefined
    ? undefined
    : { cause: reviveError(cause) })

  Object.defineProperty(error, 'name', {
    value: name, configurable: true, writable: true
  })
  error.stack = stack

  return Object.assign(error, props)
}

function cloneable (value) {
  try {
    return structuredClone(value)
  } catch {
    return inspect(value)
  }
}
