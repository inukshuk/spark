import { test } from 'node:test'
import { runRenderer } from '../../lib/spark.js'
import { F } from '../support/fixtures.js'
import { assertTestNames } from '../support/stream.js'

let files = [F.test('web')]
let WebAPIs = [
  'indexedDB',
  'localStorage',
  'sessionStorage'
]

test('web APIs are available by default', () =>
  assertTestNames(runRenderer({ files }), WebAPIs))

test('web APIs are not available with about:blank', () =>
  assertTestNames(
    runRenderer({ files, url: 'about:blank' }),
    WebAPIs,
    'fail'))
