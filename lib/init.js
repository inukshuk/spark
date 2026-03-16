import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'

export function init (cb) {
  let tmp = mkdtempSync(join(tmpdir(), `${app.getName()}-`))

  app.setPath('appData', tmp)
  app.setPath('cache', join(tmp, 'cache'))
  app.setPath('logs', join(tmp, 'logs'))
  app.setPath('crashDumps', join(tmp, 'crashDumps'))

  cb?.(tmp)
}
