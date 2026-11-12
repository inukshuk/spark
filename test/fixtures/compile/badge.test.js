import assert from 'node:assert/strict'
import { test } from 'node:test'
import { badge } from './badge.jsx'

test('badge', () => {
  assert.deepEqual(badge(1), { type: 'b', props: null, children: ['1'] })
})
