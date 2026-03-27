import assert from 'node:assert/strict'
import { test } from 'node:test'
import { F } from '../support/fixtures.js'

test('createElement', () => {
  let particle = document.createElement('div')
  particle.textContent = 'muon'
  document.body.appendChild(particle)
  assert.equal(document.body.textContent, 'muon')
})

test('querySelector', () => {
  let particle = document.createElement('span')
  particle.id = 'electron'
  particle.dataset.charge = '-1'
  document.body.appendChild(particle)
  let detected = document.querySelector('#electron')
  assert.equal(detected.dataset.charge, '-1')
})

test('classList', () => {
  let particle = document.createElement('div')
  particle.classList.add('lepton', 'charged')
  assert.ok(particle.classList.contains('lepton'))
  particle.classList.remove('charged')
  assert.ok(!particle.classList.contains('charged'))
  assert.ok(particle.classList.contains('lepton'))
})

test('run after dom-ready', () => {
  assert.equal(document.readyState, 'complete')
})

test('file:// load is blocked by default', { timeout: 2000 }, async () => {
  let img = new Image()

  let res = await new Promise((resolve, reject) => {
    img.onload = () => resolve('loaded')
    img.onerror = () => resolve('error')
    img.src = `file://${F.join('pixel.png')}`
    setTimeout(() => resolve('timeout'), 1000)
  })

  assert.notEqual(res, 'loaded')
})
