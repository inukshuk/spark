import assert from 'node:assert/strict'

assert.equal(typeof module, 'undefined', 'preload.js must run as esm')

globalThis.SPARK_PRELOAD_ESM = true
