import { styleText } from 'node:util'
import config from '../config.js'

const locale = process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || ''
const supportsUnicode = process.env.TERM !== 'dumb' &&
  (locale === '' || /utf-?8/i.test(locale))

export const sym = {
  rule: supportsUnicode ? '\u2500' : '-',
  beam: {
    pass: supportsUnicode ? '\u2502' : '|',
    fail: supportsUnicode ? '\u2736' : '*',
    skip: supportsUnicode ? '\u2506' : ':',
    end: supportsUnicode ? '\u2575' : "'",
  },
  sparks: {
    pass: supportsUnicode ? '\u00B7' : '.',
    fail: supportsUnicode ? '\u2736' : '*',
    skip: '-',
    more: supportsUnicode ? '[\u2026]' : '[..]',
  },
}

export const RULE_WIDTH = 47

export const colors = {
  green: (s) => styleText('green', s),
  red: (s) => styleText('red', s),
  dim: (s) => styleText('dim', s),
  yellow: (s) => styleText('yellow', s),
  blue: (s) => styleText('blue', s),
}

const BASE = '  '

export function indent (nesting) {
  return BASE + '  '.repeat(nesting)
}

export function formatDuration (ms) {
  if (ms >= 59950) { let m = Math.floor(ms / 60000); let s = Math.round((ms % 60000) / 1000); if (s === 60) { m++; s = 0 } return s ? `${m}m ${s}s` : `${m}m` }
  if (ms >= 1000) return `${+((ms / 1000).toFixed(1))}s`
  if (ms >= 1) return `${ms.toFixed(0)}ms`
  return `${+(ms.toFixed(1))}ms`
}

export function formatErrorMessage (error) {
  let err = error?.code === 'ERR_TEST_FAILURE' ? error.cause : error
  return err?.message ?? String(err)
}

export function formatStack (error) {
  let err = error?.code === 'ERR_TEST_FAILURE' ? error.cause : error
  if (!err?.stack) return ''

  let frames = []
  for (let line of err.stack.split('\n')) {
    let site = parseSite(line)
    if (site) frames.push(site)
  }
  if (!frames.length) return ''

  if (config.verbose)
    return frames.map(f => colors.dim(`at ${f.file}:${f.line}`)).join('\n')

  let project = frames.filter(f => !f.internal && !f.nodeModule)
  return project.map(f => colors.dim(`at ${f.file}:${f.line}`)).join('\n')
}

export function formatSummary (pad, counts, duration_ms, passSymbol, failSymbol, skipSymbol, hint) {
  let skipped = counts.skipped + (counts.todo ?? 0)
  let cancelled = counts.cancelled ?? 0

  let raw = [`${passSymbol}${counts.passed} pass`]
  let styled = [colors.green(`${passSymbol}${counts.passed} pass`)]

  if (counts.failed) {
    raw.push(`${failSymbol}${counts.failed} fail`)
    styled.push(colors.red(`${failSymbol}${counts.failed} fail`))
  }

  if (cancelled) {
    raw.push(`${failSymbol}${cancelled} cancel`)
    styled.push(colors.red(`${failSymbol}${cancelled} cancel`))
  }
  if (skipped) {
    raw.push(`${skipSymbol}${skipped} skip`)
    styled.push(colors.dim(`${skipSymbol}${skipped} skip`))
  }

  if (hint) {
    raw.push(hint)
    styled.push(colors.dim(hint))
  }

  let stats = raw.join('   ')
  let duration = formatDuration(duration_ms)
  let gap = Math.max(1, RULE_WIDTH - stats.length - duration.length)

  let line = styled.join('   ') + ' '.repeat(gap) + colors.dim(duration)

  let rule = sym.rule.repeat(RULE_WIDTH)
  let out = `\n${pad}${colors.dim(rule)}\n${pad}${line}\n`
  out += `${pad}${colors.dim(rule)}\n`
  return out
}

export function formatFailure (pad, test, failSymbol) {
  let prefix = test.process === 'renderer' ? '-r ' : ''
  let file = test.file ? relativePath(test.file) : ''
  let loc = file && test.line ? `${file}:${test.line}` : file

  let out = `${pad}${colors.red(`${failSymbol}${test.name}`)}\n`
  if (loc)
    out += `${pad}  ${colors.dim(`${prefix}${loc}`)}\n`

  if (test.details?.error) {
    let message = formatErrorMessage(test.details.error)
    let indent = `${pad}    `
    out += `${indent}${message.split('\n').join(`\n${indent}`)}\n`

    let stack = formatStack(test.details.error)
    if (stack) {
      let sindent = `${indent}  `
      out += `${sindent}${stack.split('\n').join(`\n${sindent}`)}\n`
    }
  }

  return out
}

export function labeledRule (label) {
  return sym.rule.repeat(2) + ` ${label} ` + sym.rule.repeat(RULE_WIDTH - 4 - label.length)
}

export function formatFailures (pad, tests, failSymbol) {
  if (!tests.length) return ''

  let out = `\n${pad}${colors.dim(labeledRule('failing tests'))}\n${pad}\n`
  for (let test of tests)
    out += formatFailure(pad, test, failSymbol) + '\n'
  return out
}

export function formatOutput (pad, lines) {
  if (!lines.length || !config.verbose) return ''

  let out = `\n${pad}${colors.dim(labeledRule('captured output'))}\n\n`
  for (let line of lines)
    out += `${colors.dim(line)}\n`
  return out
}

const CWD = process.cwd()
const FILE_URL_PREFIX = 'file://' + CWD + '/'

export function relativePath (file) {
  return file.replace(FILE_URL_PREFIX, '').replace(CWD + '/', '')
}

function parseSite (line) {
  let trimmed = line.trim()
  if (!trimmed.startsWith('at ')) return null

  let internal = trimmed.includes('node:')

  // "at fn (file:line:col)" or "at file:line:col"
  let match = trimmed.match(/\((.+):(\d+):\d+\)$/) || trimmed.match(/^at (.+):(\d+):\d+$/)
  if (!match) return null

  let file = match[1].replace(FILE_URL_PREFIX, '')
  let nodeModule = file.includes('node_modules/')
  return { file, line: match[2], internal, nodeModule }
}
