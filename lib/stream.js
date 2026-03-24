import { PassThrough, Readable, Transform } from 'node:stream'
import { mergeCoverageData } from './coverage.js'

export async function report (source, pairs, tapper) {
  let values = []
  if (tapper)
    source = source.compose(tapper(data => values.push(data)))

  await Promise.all(pairs.map(([reporter, dest]) => {
    let stream = source.compose(reporter)
    stream.pipe(dest)
    return new Promise((resolve, reject) => {
      stream.on('end', resolve)
      stream.on('error', reject)
    })
  }))
  return values
}

export function tap (type) {
  return (fn) => async function * (source) {
    for await (let event of source) {
      if (event.type === type) fn(event.data)
      yield event
    }
  }
}

export function combine (sources) {
  if (sources.length === 1) return sources[0]
  return Readable.from(merge(sources), { objectMode: true })
}

async function * merge (sources) {
  let n = sources.length
  let planCount = 0
  let plansSeen = 0
  let summaries = []
  let diagnostics = {}
  let coverages = []

  let pt = new PassThrough({ objectMode: true })
  let pending = n

  for (let source of sources) {
    source.on('data', (event) => pt.write(event))
    source.on('error', () => { if (--pending === 0) pt.end() })
    source.on('end', () => { if (--pending === 0) pt.end() })
  }

  for await (let event of pt) {
    let { type, data } = event

    if (type === 'test:summary') {
      summaries.push(data)
      if (summaries.length === n) {
        for (let [key, val] of Object.entries(diagnostics))
          yield { type: 'test:diagnostic', data: { nesting: 0, message: `${key} ${val}` } }
        if (coverages.length)
          yield { type: 'test:coverage', data: mergeCoverageData(coverages.map(e => e.data)) }
        yield { type: 'test:summary', data: mergeSummaries(summaries) }
      }
      continue
    }

    if (type === 'test:coverage') { coverages.push(event); continue }

    if (data?.nesting === 0) {
      if (type === 'test:plan') {
        planCount += data.count
        if (++plansSeen === n)
          yield { type: 'test:plan', data: { nesting: 0, count: planCount } }
        continue
      }
      if (type === 'test:diagnostic') {
        let [key, val] = data.message.split(' ')
        diagnostics[key] = (diagnostics[key] ?? 0) + Number(val)
        continue
      }
    }

    yield event
  }

  if (summaries.length < n) {
    while (summaries.length < n) {
      summaries.push({
        counts: {
          passed: 0,
          failed: 0,
          cancelled: 0,
          skipped: 0,
          todo: 0,
          suites: 0,
          tests: 0,
          topLevel: 0
        },
        success: false
      })
    }
    for (let [key, val] of Object.entries(diagnostics))
      yield { type: 'test:diagnostic', data: { nesting: 0, message: `${key} ${val}` } }
    if (coverages.length)
      yield { type: 'test:coverage', data: mergeCoverageData(coverages.map(e => e.data)) }
    yield { type: 'test:summary', data: mergeSummaries(summaries) }
  }
}

export function filter (predicate) {
  return new Transform({
    objectMode: true,
    transform (event, enc, cb) {
      if (predicate(event))
        cb()
      else
        cb(null, event)
    }
  })
}

export const filterStdErr = (pattern) => filter(e => (
  (e.type === 'test:stderr' && pattern.test(e.data.message))
))

function mergeSummaries (summaries) {
  let counts = {}
  let duration_ms = 0
  for (let s of summaries) {
    for (let [key, val] of Object.entries(s.counts))
      counts[key] = (counts[key] ?? 0) + val
    duration_ms += s.duration_ms
  }
  return {
    counts,
    duration_ms,
    success: summaries.every((s) => s.success)
  }
}
