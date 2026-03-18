import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runMain, runRenderer } from '../../lib/spark.js'
import { F } from '../support/fixtures.js'
import { collectCoverage, coveredFunctions } from '../support/stream.js'

describe('coverage', () => {
  describe('main', () => {
    it('collects coverage with isolation="process"', async () => {
      let coverages = await collectCoverage(runMain({
        files: [F.test('chamber')],
        coverage: true,
        isolation: 'process',
      }))

      assert.equal(coverages.length, 1)

      let covered = coveredFunctions(coverages, F.js('chamber'))
      assert.ok(covered.has('ionize'), 'ionize should be covered')
    })

    it('collects coverage with isolation="none"', {
      skip: !process.env.NODE_V8_COVERAGE && 'requires NODE_V8_COVERAGE at startup'
    }, async () => {
      let coverages = await collectCoverage(runMain({
        files: [F.test('chamber')],
        coverage: true,
        isolation: 'none',
      }))

      assert.equal(coverages.length, 1)

      let covered = coveredFunctions(coverages, F.js('chamber'))
      assert.ok(covered.has('ionize'), 'ionize should be covered')
    })
  })

  describe('renderer', () => {
    it('collects coverage')
  })

  describe('combined', () => {
    it('collects coverage both combined', {
      skip: process.platform === 'win32'
    }, async () => {
      let shared = {
        globPatterns: [F.test('chamber')],
        coverage: true,
      }

      let [mainCov, rendererCov] = await Promise.all([
        collectCoverage(runMain({ ...shared, isolation: 'process' })),
        collectCoverage(runRenderer(shared))
      ])

      let coverages = [...mainCov, ...rendererCov]
      assert.equal(coverages.length, 2)

      let covered = coveredFunctions(coverages, F.js('chamber'))
      assert.ok(covered.has('ionize'), 'ionize should be covered')
      assert.ok(covered.has('detect'), 'detect should be covered')
    })
  })
})
