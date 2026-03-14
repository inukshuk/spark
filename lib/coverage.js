export async function startInspector () {
  let { Session } = await import('node:inspector/promises')
  let session = new Session()
  session.connect()
  await session.post('Profiler.enable')
  await session.post('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true
  })

  return async () => {
    let { result } = await session.post('Profiler.takePreciseCoverage')
    await session.post('Profiler.stopPreciseCoverage')
    await session.post('Profiler.disable')
    session.disconnect()
    return fromV8(result)
  }
}

export async function startDebugger (webContents) {
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
    return fromV8(result)
  }
}

function fromV8 (result) {
  let files = []

  for (let entry of result) {
    if (!entry.url.startsWith('file://')) continue

    let functions = []
    for (let fn of entry.functions) {
      if (fn.functionName) {
        functions.push({
          name: fn.functionName,
          count: fn.ranges[0].count
        })
      }
    }

    if (functions.length) {
      files.push({
        path: new URL(entry.url).pathname,
        functions
      })
    }
  }

  return {
    nesting: 0,
    summary: { files }
  }
}
