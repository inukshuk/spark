import { describe, it } from 'node:test'

describe('broken suite', () => {
  throw new Error('suite body failed')
})

describe('working suite', () => {
  it('works', () => {})
})
