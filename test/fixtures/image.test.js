import assert from 'node:assert/strict'
import { test } from 'node:test'
import { F } from '../support/fixtures.js'

test('file:// image', { timeout: 2000 }, async () => {
  let img = new Image()
  let res = await new Promise((resolve, reject) => {
    img.onload = () => resolve('loaded')
    img.onerror = () => resolve('error')
    img.src = `file://${F.join('pixel.png')}`
    setTimeout(() => resolve('timeout'), 1000)
  })

  assert.equal(res, 'loaded')
  assert.equal(img.naturalWidth, 1)
  assert.equal(img.naturalHeight, 1)
})
