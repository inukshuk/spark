import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('Web API', () => {
  it('indexedDB', () => (
    new Promise((resolve, reject) => {
      let chamber = window.indexedDB.open('SparkChamber')
      chamber.onerror = reject
      chamber.onsuccess = resolve
    })
  ))

  it('localStorage', () => {
    window.localStorage.setItem('particle', 'detected!')
    assert.equal(window.localStorage.getItem('particle'), 'detected!')
  })

  it('sessionStorage', () => {
    window.sessionStorage.setItem('particle', 'detected!')
    assert.equal(window.sessionStorage.getItem('particle'), 'detected!')
  })
})
