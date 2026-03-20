import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app, protocol } from 'electron'

export function registerScheme () {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'spark',
    privileges: { standard: true, secure: true }
  }])
}

export function handleScheme () {
  if (!protocol.isProtocolHandled('spark')) {
    protocol.handle('spark', () => new Response('<html></html>', {
      headers: { 'content-type': 'text/html' }
    }))
  }
}

export function setupPaths () {
  let tmp = mkdtempSync(join(tmpdir(), `${app.getName()}-`))

  app.setPath('appData', tmp)
  app.setPath('cache', join(tmp, 'cache'))
  app.setPath('logs', join(tmp, 'logs'))
  app.setPath('crashDumps', join(tmp, 'crashDumps'))
}

export default function init () {
  if (app.getName() === 'spark')
    setupPaths()

  registerScheme()
  app.whenReady().then(handleScheme)
}
