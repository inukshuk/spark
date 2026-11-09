import { relative } from 'node:path'
import { test } from 'node:test'
import { runRenderer } from '../../lib/spark.js'
import { F } from '../support/fixtures.js'
import { assertTestNames } from '../support/stream.js'

let files = [F.test('preload')]
let names = ['esm preload ran', 'cjs preload ran']

test('relative preload paths resolve against cwd', () =>
  assertTestNames(
    runRenderer({
      files,
      preload: [
        relative(process.cwd(), F.join('preload.cjs')),
        relative(process.cwd(), F.js('preload'))
      ]
    })[0],
    names))
