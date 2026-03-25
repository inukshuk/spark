import { styleText } from 'node:util'

const locale = process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || ''
const supportsUnicode = process.env.TERM !== 'dumb' &&
  (locale === '' || /utf-?8/i.test(locale))

export const sym = {
  rule: supportsUnicode ? '\u2500' : '-',
  beam: {
    pass: supportsUnicode ? '\u2502' : '|',
    fail: supportsUnicode ? '\u2736' : '*',
    skip: supportsUnicode ? '\u2506' : ':',
    end:  supportsUnicode ? '\u2575' : "'",
  },
  sparks: {
    pass: supportsUnicode ? '\u00B7' : '.',
    fail: supportsUnicode ? '\u2736' : '*',
    skip: '-',
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

export function formatError (error) {
  let err = error?.code === 'ERR_TEST_FAILURE' ? error.cause : error

  if (err?.code === 'ERR_ASSERTION') {
    let site = firstSite(err)
    return site ? `${err.message}\n${colors.dim(site)}` : err.message
  }

  let message = err?.message ?? String(err)
  let site = firstSite(err)
  return site ? `${message}\n${colors.dim(site)}` : message
}

export function formatSummary (pad, counts, duration_ms, passSymbol, failSymbol, skipSymbol) {
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

  let stats = raw.join('   ')
  let duration = formatDuration(duration_ms)
  let gap = Math.max(1, RULE_WIDTH - stats.length - duration.length)

  let line = styled.join('   ') + ' '.repeat(gap) + colors.dim(duration)

  let rule = sym.rule.repeat(RULE_WIDTH)
  return `\n${pad}${colors.dim(rule)}\n${pad}${line}\n${pad}${colors.dim(rule)}\n`
}

export function formatFailures (pad, tests, failSymbol, formatErr) {
  if (!tests.length) return ''

  let label = ' failing tests '
  let rule = sym.rule.repeat(2) + label + sym.rule.repeat(RULE_WIDTH - 2 - label.length)
  let out = `\n${pad}${colors.red(rule)}\n\n`
  for (let test of tests) {
    let suffix = test.process ? ` ${colors.dim(`(${test.process})`)}` : ''
    out += `${pad}${colors.red(`${failSymbol}${test.name}`)}${suffix}\n`
    if (test.details?.error)
      out += `${pad}  ${formatErr(test.details.error).split('\n').join(`\n${pad}  `)}\n`
  }
  return out
}

const CWD = process.cwd()
const FILE_URL_PREFIX = 'file://' + CWD + '/'

function firstSite (err) {
  if (!err?.stack) return ''
  for (let line of err.stack.split('\n')) {
    let trimmed = line.trim()
    if (!trimmed.startsWith('at ') || trimmed.includes('node:'))
      continue
    // "at fn (file:line:col)" → "at fn (file:line)"
    let match = trimmed.match(/^(at .+)\((.+):(\d+):\d+\)$/)
    if (match) {
      let file = match[2].replace(FILE_URL_PREFIX, '')
      return `${match[1]}(${file}:${match[3]})`
    }
    // "at file:line:col" → "at file:line"
    match = trimmed.match(/^at (.+):(\d+):\d+$/)
    if (match) {
      let file = match[1].replace(FILE_URL_PREFIX, '')
      return `at ${file}:${match[2]}`
    }
  }
  return ''
}
