import { writeFile, mkdir } from 'node:fs/promises'
import { findSourceMap } from 'node:module'
import { join } from 'node:path'
import process from 'node:process'

// Captured early because in-process test.run() temporarily swaps it!
export const V8_COVERAGE_DIR = process.env.NODE_V8_COVERAGE

// Collects the renderer's V8 coverage via CDP: Chromium's V8 has
// no coverage connection, so NODE_V8_COVERAGE alone does nothing there.
export async function startCoverage (webContents) {
  let dbg = webContents.debugger

  dbg.attach()
  await dbg.sendCommand('Profiler.enable')
  await dbg.sendCommand('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true
  })

  let stopped

  return () => (stopped ??= (async () => {
    let { data } = await dbg.sendCommand('Profiler.takePreciseCoverage')
    await dbg.sendCommand('Profiler.stopPreciseCoverage')
    await dbg.sendCommand('Profiler.disable')
    dbg.detach()
    return data
  })())
}

// Writes raw coverage the way Node does to NODE_V8_COVERAGE,
// including the source maps of scripts transformed on load.
// Runs in the renderer, where Node's test runner (or c8) picks it up.
export async function writeCoverage (result, dir = process.env.NODE_V8_COVERAGE) {
  let sourceMapCache = {}

  for (let { url } of result) {
    let sourceMap = url.startsWith('file:') && findSourceMap(url)
    if (sourceMap)
      sourceMapCache[url] = {
        data: sourceMap.payload,
        lineLengths: sourceMap.lineLengths
      }
  }

  let name = `coverage-${process.pid}-${Date.now()}-0.json`
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), JSON.stringify({
    result,
    'source-map-cache': sourceMapCache
  }))
}

export function mergeCoverageData (coverages) {
  // Deduplicate files by path, merging counts with max.
  // The same file may appear in both main and renderer coverage
  // (e.g., a module imported in both processes).
  let byPath = new Map()

  for (let cov of coverages) {
    for (let file of cov.summary.files) {
      let existing = byPath.get(file.path)
      if (!existing) {
        byPath.set(file.path, file)
      } else {
        mergeFile(existing, file)
      }
    }
  }

  let files = [...byPath.values()]
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)

  let totals = {
    totalLineCount: 0,
    totalBranchCount: 0,
    totalFunctionCount: 0,
    coveredLineCount: 0,
    coveredBranchCount: 0,
    coveredFunctionCount: 0,
  }

  for (let file of files) {
    totals.totalLineCount += file.totalLineCount
    totals.totalBranchCount += file.totalBranchCount
    totals.totalFunctionCount += file.totalFunctionCount
    totals.coveredLineCount += file.coveredLineCount
    totals.coveredBranchCount += file.coveredBranchCount
    totals.coveredFunctionCount += file.coveredFunctionCount
  }

  totals.coveredLinePercent = toPercent(totals.coveredLineCount, totals.totalLineCount)
  totals.coveredBranchPercent = toPercent(totals.coveredBranchCount, totals.totalBranchCount)
  totals.coveredFunctionPercent = toPercent(totals.coveredFunctionCount, totals.totalFunctionCount)

  return {
    nesting: 0,
    summary: {
      workingDirectory: coverages[0]?.summary.workingDirectory ?? process.cwd(),
      files,
      totals,
      thresholds: { line: 0, branch: 0, function: 0 }
    }
  }
}

function mergeFile (target, source) {
  for (let line of source.lines)
    mergeEntry(target.lines, 'line', line)

  for (let branch of source.branches)
    mergeEntry(target.branches, 'line', branch)

  for (let fn of source.functions)
    mergeEntry(target.functions, 'name', fn)

  target.totalLineCount = target.lines.length
  target.totalBranchCount = target.branches.length
  target.totalFunctionCount = target.functions.length
  target.coveredLineCount = target.lines.filter(l => l.count > 0).length
  target.coveredBranchCount = target.branches.filter(b => b.count > 0).length
  target.coveredFunctionCount = target.functions.filter(f => f.count > 0).length
  target.coveredLinePercent = toPercent(target.coveredLineCount, target.totalLineCount)
  target.coveredBranchPercent = toPercent(target.coveredBranchCount, target.totalBranchCount)
  target.coveredFunctionPercent = toPercent(target.coveredFunctionCount, target.totalFunctionCount)
}

function mergeEntry (arr, key, entry) {
  let existing = arr.find(e => e[key] === entry[key])
  if (existing) {
    existing.count = Math.max(existing.count, entry.count)
  } else {
    arr.push(entry)
  }
}

function toPercent (covered, total) {
  return total === 0 ? 100 : (covered / total) * 100
}
