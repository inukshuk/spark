import process from 'node:process'
import { join } from 'node:path'
import { styleText } from 'node:util'
import { finished } from 'node:stream/promises'
import { app, BrowserWindow, ipcMain } from 'electron'
import { parse, usage } from './args.js'

import * as test from 'node:test'
import * as reporters from 'node:test/reporters'

try {
  let opts = parse()

  if (opts.help) {
    console.log(usage())
    app.exit(0)
  }

  if (opts.version) {
    console.log(`${opts.version} (${process.versions.electron})`)
    app.exit(0)
  }

  if (app.isReady())
    run(opts)
  else
    app.on('ready', () => run(opts))

} catch (e) {
  console.error(usage())
  console.error(`${styleText('red', 'ERROR:')} ${e.message}`)
  console.error(styleText('gray', e.stack))
  app.exit(1)
}

async function run (opts) {
  let failures = 0

  let source = test.run({
    files: [
      'test/main/process_test.js',
    ],
    isolation: 'none',
    watch: false
  })

  let pending = 0

  source.on('test:enqueue', () => { ++pending })
  source.on('test:complete', () => {
    if (--pending === 0)
      process.emit('beforeExit')
  })
  source.on('test:fail', () => { ++failures })

  source
    .compose(reporters.spec)
    .pipe(process.stdout)

  await finished(source)

  failures += await runRenderer()
  app.exit(failures)
}

async function runRenderer () {
  return new Promise((resolve) => {
    let win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: join(import.meta.dirname, './preload.cjs'),
        sandbox: false
      }
    })

    ipcMain.on('test:output', (e, chunk) => {
      process.stdout.write(chunk)
    })

    ipcMain.on('test:done', (e, failures) => {
      win.close()
      resolve(failures)
    })

    win.loadURL('about:blank')
  })
}
