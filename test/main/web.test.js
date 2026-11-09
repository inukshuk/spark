import { relative } from 'node:path'
import { test } from 'node:test'
import { runRenderer } from '../../lib/spark.js'
import config from '../../lib/config.js'
import { F } from '../support/fixtures.js'
import { assertTestNames } from '../support/stream.js'

let files = [F.test('web')]
let WebAPIs = [
  'indexedDB',
  'localStorage',
  'sessionStorage'
]

test('web APIs are available by default', () =>
  assertTestNames(runRenderer({ files })[0], WebAPIs))

test('web APIs are not available with about:blank', () =>
  assertTestNames(
    runRenderer({ files, url: 'about:blank' })[0],
    WebAPIs,
    'fail'))

test('the configured url is loaded', async (t) => {
  let url = config.url
  config.url = 'about:blank'
  t.after(() => { config.url = url })
  await assertTestNames(runRenderer({ files })[0], WebAPIs, 'fail')
})

test('a url path loads as a file URL', () =>
  assertTestNames(
    runRenderer({
      files: [F.test('page')],
      url: relative(process.cwd(), F.join('page.html'))
    })[0],
    ['file: page']))

test('an absolute url path loads as a file URL', () =>
  assertTestNames(
    runRenderer({
      files: [F.test('page')],
      url: F.join('page.html')
    })[0],
    ['file: page']))

test('file:// image loads with webSecurity disabled', () =>
  assertTestNames(
    runRenderer({
      files: [F.test('image')],
      webPreferences: { webSecurity: false }
    })[0],
    ['file:// image']))
