import { readFileSync } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

export async function startCoverage (out, webContents) {
  let dbg = webContents.debugger

  dbg.attach()
  await dbg.sendCommand('Profiler.enable')
  await dbg.sendCommand('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true
  })

  return async () => {
    let { result } = await dbg.sendCommand('Profiler.takePreciseCoverage')
    await dbg.sendCommand('Profiler.stopPreciseCoverage')
    await dbg.sendCommand('Profiler.disable')
    dbg.detach()

    if (process.env.NODE_V8_COVERAGE)
      await writeRawCoverage(result, {
        dir: process.env.NODE_V8_COVERAGE,
        pid: process.pid,
        seq: webContents.id
      })

    let data = processCoverage(result)
    out?.write({ type: 'test:coverage', data })

    return data
  }
}

async function writeRawCoverage (result, { dir, pid, seq }) {
  let name = `coverage-${pid}-${Date.now()}-${seq}.json`
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), JSON.stringify({ result }))
}

/**
 * Coverage processing adapted from Node.js test runner
 * https://github.com/nodejs/node/blob/main/lib/internal/test_runner/coverage.js
 * Copyright Node.js contributors. Licensed under MIT.
 */

// Split source into lines, tracking character offsets.
// Lines retain their newline so offsets stay contiguous.
// Adapted from Node's CoverageLine + getLines.
function getLines (filePath) {
  let source
  try {
    source = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  let lines = []
  let offset = 0

  for (let part of source.split(/(?<=\r?\n)/)) {
    let newline = part.match(/\r?\n$/)?.[0].length ?? 0
    let startOffset = offset
    let endOffset = offset + part.length - newline

    lines.push({
      line: lines.length + 1,
      startOffset,
      endOffset,
      count: startOffset === endOffset ? 1 : 0
    })

    offset += part.length
  }

  return lines
}

// Binary search for startOffset, iterate forward to endOffset.
// Sets line.count for lines fully covered by the range.
// Adapted from Node's mapRangeToLines.
function mapRangeToLines (range, lines) {
  let { startOffset, endOffset, count } = range
  let mapped = []
  let lo = 0
  let hi = lines.length

  while (lo <= hi) {
    let mid = (lo + hi) >>> 1
    let line = lines[mid]

    if (startOffset >= line?.startOffset && startOffset <= line?.endOffset) {
      while (endOffset > line?.startOffset) {
        if (startOffset <= line.startOffset && endOffset >= line.endOffset)
          line.count = count

        mapped.push(line)
        line = lines[++mid]
      }
      break
    } else if (startOffset >= line?.endOffset) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return mapped
}

function toPercent (covered, total) {
  return total === 0 ? 100 : (covered / total) * 100
}

function processCoverage (result) {
  let cwd = process.cwd()
  let files = []
  let totals = {
    totalLineCount: 0,
    totalBranchCount: 0,
    totalFunctionCount: 0,
    coveredLineCount: 0,
    coveredBranchCount: 0,
    coveredFunctionCount: 0,
  }

  for (let entry of result) {
    if (!entry.url.startsWith('file://')) continue
    if (entry.url.includes('/node_modules/')) continue

    let filePath = new URL(entry.url).pathname
    let lines = getLines(filePath)
    if (!lines) continue

    let functions = []
    let branches = []
    let totalFunctions = 0
    let coveredFunctions = 0
    let totalBranches = 0
    let coveredBranches = 0

    for (let j = 0; j < entry.functions.length; j++) {
      let fn = entry.functions[j]
      let maxCount = 0
      let firstLine

      for (let k = 0; k < fn.ranges.length; k++) {
        let range = fn.ranges[k]
        maxCount = Math.max(maxCount, range.count)
        let mapped = mapRangeToLines(range, lines)

        if (k === 0) firstLine = mapped[0]?.line

        if (fn.isBlockCoverage) {
          branches.push({ line: mapped[0]?.line, count: range.count })
          if (range.count !== 0) coveredBranches++
          totalBranches++
        }
      }

      // Skip j === 0: script-level wrapper, not a real function
      if (j > 0 && fn.ranges.length > 0) {
        functions.push({ name: fn.functionName, count: maxCount, line: firstLine })
        if (maxCount > 0) coveredFunctions++
        totalFunctions++
      }
    }

    let coveredLineCount = 0
    let lineReports = []

    for (let line of lines) {
      lineReports.push({ line: line.line, count: line.count })
      if (line.count > 0) coveredLineCount++
    }

    files.push({
      path: filePath,
      totalLineCount: lines.length,
      totalBranchCount: totalBranches,
      totalFunctionCount: totalFunctions,
      coveredLineCount,
      coveredBranchCount: coveredBranches,
      coveredFunctionCount: coveredFunctions,
      coveredLinePercent: toPercent(coveredLineCount, lines.length),
      coveredBranchPercent: toPercent(coveredBranches, totalBranches),
      coveredFunctionPercent: toPercent(coveredFunctions, totalFunctions),
      functions,
      branches,
      lines: lineReports
    })

    totals.totalLineCount += lines.length
    totals.totalBranchCount += totalBranches
    totals.totalFunctionCount += totalFunctions
    totals.coveredLineCount += coveredLineCount
    totals.coveredBranchCount += coveredBranches
    totals.coveredFunctionCount += coveredFunctions
  }

  totals.coveredLinePercent = toPercent(totals.coveredLineCount, totals.totalLineCount)
  totals.coveredBranchPercent = toPercent(totals.coveredBranchCount, totals.totalBranchCount)
  totals.coveredFunctionPercent = toPercent(totals.coveredFunctionCount, totals.totalFunctionCount)

  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)

  return {
    nesting: 0,
    summary: {
      workingDirectory: cwd,
      files,
      totals,
      thresholds: { line: 0, branch: 0, function: 0 }
    }
  }
}
