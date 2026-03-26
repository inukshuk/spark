import config from '../config.js'
import { indent, colors, formatSummary, formatFailures, formatOutput, sym } from './symbols.js'

const { pass: PASS, fail: FAIL, skip: SKIP, more: MORE } = sym.sparks

const GROUP = 5
const GROUPS_PER_LINE = 8
const DOTS_PER_LINE = GROUP * GROUPS_PER_LINE

export default async function * sparks (source) {
  let pad = indent(0)
  let count = 0
  let failedTests = []
  let output = []
  let started = false

  for await (let { type, data } of source) {
    if (type === 'test:pass' || type === 'test:fail') {
      if (data.details?.type === 'suite') continue
      if (!started) { yield pad; started = true }
      if (data.skip !== undefined || data.todo !== undefined) {
        yield colors.dim(SKIP)
      } else if (type === 'test:fail') {
        yield colors.red(FAIL)
        failedTests.push(data)
      } else {
        yield colors.green(PASS)
      }
    } else if (type === 'test:stdout' || type === 'test:stderr') {
      output.push(data.message.replace(/\n$/, ''))
      continue
    } else if (type === 'test:summary' && data.file === undefined) {
      if (count !== 0) yield '\n'
      let hint = output.length && !config.verbose ? MORE : ''
      yield formatSummary(pad, data.counts, data.duration_ms, `${PASS} `, `${FAIL} `, `${SKIP} `, hint)
      continue
    } else {
      continue
    }

    count++
    if (count === DOTS_PER_LINE) {
      yield `\n${pad}`
      count = 0
    } else if (count % GROUP === 0) {
      yield ' '
    }
  }

  yield formatFailures(pad, failedTests, `${FAIL} `)
  yield formatOutput(pad, output)
}
