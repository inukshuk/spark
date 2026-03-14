import { PassThrough } from 'node:stream'
import { Readable } from 'node:stream'

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
    source.on('error', (err) => { if (!pt.destroyed) pt.destroy(err) })
    source.on('end', () => { if (--pending === 0) pt.end() })
  }

  for await (let event of pt) {
    let { type, data } = event

    if (type === 'test:summary') {
      summaries.push(data)
      if (summaries.length === n) {
        for (let [key, val] of Object.entries(diagnostics))
          yield { type: 'test:diagnostic', data: { nesting: 0, message: `${key} ${val}` } }
        for (let c of coverages) yield c
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
}

function mergeSummaries (summaries) {
  let counts = {}
  for (let s of summaries) {
    for (let [key, val] of Object.entries(s.counts))
      counts[key] = (counts[key] ?? 0) + val
  }
  return {
    ...summaries[0],
    counts,
    success: summaries.every((s) => s.success)
  }
}
