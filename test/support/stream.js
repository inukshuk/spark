import assert from 'node:assert/strict'

export async function collect (stream, type) {
  let events = await stream.toArray()

  if (typeof type === 'function')
    return events.filter(type)
  if (type)
    return events.filter(e => e.type === type)
  else
    return events
}

export function collectTests (stream, status = 'pass') {
  return collect(stream, e => (
    e.type === `test:${status}` && e.data.details?.type === 'test'
  ))
}

export async function assertTestNames (stream, expected, status = 'pass') {
  let events = await collectTests(stream, status)
  let names = events.map(e => e.data.name)
  assert.deepEqual(names, expected)
}

export async function collectCoverage (stream) {
  let events = await collect(stream, 'test:coverage')
  return events.map(e => e.data)
}

export function coveredFunctions (coverages, filePath) {
  let covered = new Set()

  for (let cov of coverages) {
    let file = cov.summary.files.find(f => f.path === filePath)
    if (file)
      for (let fn of file.functions)
        if (fn.count > 0) covered.add(fn.name)
  }

  return covered
}
