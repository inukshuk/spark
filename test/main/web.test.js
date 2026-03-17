import { test } from 'node:test'
import { runRenderer } from '../../lib/spark.js'
import { assertTestNames, F } from '../support.js'

let files = [F.test('web')]

test('web APIs are available by default', () =>
  assertTestNames(runRenderer({ files }), ['indexedDB', 'localStorage', 'sessionStorage']))

test('web APIs are not available with about:blank', () =>
  assertTestNames(runRenderer({
    files, url: 'about:blank'
  }), ['indexedDB', 'localStorage', 'sessionStorage'], 'fail'))
