import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runMain, runRenderer } from '../../lib/spark.js'
import { F } from '../support.js'

test('coverage from main and renderer combined', {
  skip: process.platform === 'win32'
}, async () => {
  let coverages = []

  let opts = {
    globPatterns: [F.test('chamber')],
    coverage: true,
  }

  async function collect (stream) {
    for await (let event of stream) {
      if (event.type === 'test:coverage')
        coverages.push(event.data)
    }
  }

  await Promise.all([
    collect(runMain(opts)),
    collect(runRenderer(opts))
  ])

  assert.equal(coverages.length, 2)

  let covered = new Set()

  for (let cov of coverages) {
    let file = cov.summary.files.find((f) => f.path === F.js('chamber'))
    assert.ok(file, 'chamber.js should appear in coverage')
    for (let fn of file.functions)
      if (fn.count > 0) covered.add(fn.name)
  }

  assert.ok(covered.has('ionize'), 'ionize should be covered')
  assert.ok(covered.has('detect'), 'detect should be covered')
})
