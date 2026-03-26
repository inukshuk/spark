import { Transform } from 'node:stream'
import config from '../config.js'
import { colors, indent, formatDuration, formatErrorMessage, formatStack, relativePath, sym } from './symbols.js'

const { pass: PASS, fail: FAIL, skip: SKIP, end: END } = sym.beam

export default class BeamReporter extends Transform {
  #stack = []
  #failedTests = []
  #output = []
  #summaryDone = false
  #pad = indent(0)

  constructor () {
    super({ writableObjectMode: true })
  }

  #beam (status) {
    if (status === 'fail') return `${this.#pad}${colors.red(FAIL)}`
    if (status === 'skip') return `${this.#pad}${colors.dim(SKIP)}`
    return `${this.#pad}${colors.green(PASS)}`
  }

  #handleEvent ({ type, data }) {
    switch (type) {
      case 'test:start':
        this.#stack.unshift({ data, type })
        break
      case 'test:pass':
      case 'test:fail':
        if (type === 'test:fail' && data.details?.error?.failureType !== 'subtestsFailed' &&
          data.skip === undefined && data.todo === undefined)
          this.#failedTests.push(data)
        return this.#formatResult(type, data)
      case 'test:stdout':
      case 'test:stderr':
        this.#output.push(data.message.replace(/\n$/, ''))
        break
      case 'test:diagnostic':
        if (data.nesting === 0) break
        return `${this.#beam('pass')} ${' '.repeat(data.nesting * 2)}${colors.blue(data.message)}\n`
      case 'test:summary':
        if (data.file === undefined) {
          this.#summaryDone = true
          return this.#formatSummary(data.counts, data.duration_ms) +
            this.#formatFailures() +
            this.#formatOutput()
        }
        break
    }
  }

  #formatResult (type, data) {
    let isSuite = data.details?.type === 'suite'

    this.#stack.shift()
    let prefix = ''

    while (this.#stack.length) {
      let parent = this.#stack.pop()
      prefix += `${this.#beam('suite')} ${' '.repeat(parent.data.nesting * 2)}${parent.data.name}\n`
    }

    let { skip, todo } = data
    let duration = data.details?.duration_ms != null
      ? colors.dim(` (${formatDuration(data.details.duration_ms)})`)
      : ''
    let suffix = ''
    let status

    if (skip !== undefined) {
      status = 'skip'
      if (typeof skip === 'string' && skip.length)
        suffix = `\n${this.#beam('skip')} ${' '.repeat(data.nesting * 2)}  ${colors.dim(`# ${skip}`)}`
    } else if (todo !== undefined) {
      status = 'skip'
      if (typeof todo === 'string' && todo.length)
        suffix = `\n${this.#beam('skip')} ${' '.repeat(data.nesting * 2)}  ${colors.yellow(`# ${todo}`)}`
    } else if (type === 'test:fail') {
      status = 'fail'
    } else {
      status = 'pass'
    }

    if (isSuite) return prefix || null

    let nest = ' '.repeat(data.nesting * 2)
    let name = status === 'fail'
      ? colors.red(data.name)
      : status === 'skip'
        ? colors.dim(data.name)
        : data.name
    return `${prefix}${this.#beam(status)} ${nest}${name}${duration}${suffix}\n`
  }

  #formatSummary (counts, duration_ms) {
    let pad = this.#pad
    let dim = colors.dim
    let skipped = counts.skipped + (counts.todo ?? 0)
    let cancelled = counts.cancelled ?? 0
    let out = `${pad}${dim(PASS)}\n`
    out += `${pad}${colors.green(PASS)} ${colors.green(`${counts.passed} pass`)}\n`
    if (counts.failed)
      out += `${pad}${colors.red(FAIL)} ${colors.red(`${counts.failed} fail`)}\n`
    if (cancelled)
      out += `${pad}${colors.red(FAIL)} ${colors.red(`${cancelled} cancel`)}\n`
    if (skipped)
      out += `${pad}${colors.dim(SKIP)} ${dim(`${skipped} skip`)}\n`
    out += `${pad}${dim(PASS)} ${dim(`in ${formatDuration(duration_ms)}`)}\n`
    if (this.#output.length && !config.verbose)
      out += `${pad}${dim(PASS)} ${dim('use --verbose for captured output')}\n`
    return out
  }

  #formatFailures () {
    let pad = this.#pad
    let dim = colors.dim
    let beam = `${pad}${dim(PASS)}`
    let out = ''
    if (this.#failedTests.length) {
      out += `${beam}\n`
      for (let test of this.#failedTests) {
        let prefix = test.process === 'renderer' ? '-r ' : ''
        let file = test.file ? relativePath(test.file) : ''
        let loc = file && test.line ? `${file}:${test.line}` : file

        out += `${pad}${colors.red(FAIL)} ${colors.red(test.name)}\n`
        if (loc)
          out += `${beam} ${dim(`${prefix}${loc}`)}\n`

        if (test.details?.error) {
          let message = formatErrorMessage(test.details.error)
          for (let line of message.split('\n'))
            out += `${beam}   ${line}\n`

          let stack = formatStack(test.details.error)
          if (stack)
            for (let line of stack.split('\n'))
              out += `${beam}     ${line}\n`
        }
      }
      this.#failedTests = []
    }
    if (!this.#output.length || !config.verbose)
      out += `${pad}${dim(END)}\n`
    return out
  }

  #formatOutput () {
    if (!this.#output.length || !config.verbose) return ''

    let pad = this.#pad
    let dim = colors.dim
    let out = `${pad}${dim(PASS)}\n${pad}${dim('+ captured output')}\n\n`
    for (let line of this.#output)
      out += `${dim(line)}\n`
    return out
  }

  _transform ({ type, data }, encoding, callback) {
    callback(null, this.#handleEvent({ type, data }))
  }

  _flush (callback) {
    callback(null, this.#summaryDone ? null : this.#formatFailures())
  }
}
