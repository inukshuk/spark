'use strict'

const assert = require('node:assert/strict')

assert.equal(typeof module, 'object', 'preload.cjs must run as commonjs')

globalThis.SPARK_PRELOAD_CJS = true
