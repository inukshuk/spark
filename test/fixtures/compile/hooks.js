// Compiles .jsx on load, like a JSX transform would: prepends a runtime
// header (shifting all lines) and inlines a source map back to the original.
import { Buffer } from 'node:buffer'
import { registerHooks } from 'node:module'
import { basename } from 'node:path'

const HEADER = [
  'const h = (type, props, ...children) =>',
  '  ({ type, props, children })'
]

registerHooks({
  load (url, context, nextLoad) {
    if (!url.endsWith('.jsx')) return nextLoad(url, context)

    let source = String(nextLoad(url, { ...context, format: 'module' }).source)
    let lines = source.split('\n')

    let map = {
      version: 3,
      sources: [basename(url)],
      names: [],
      mappings: ';'.repeat(HEADER.length) +
        lines.map((_, i) => i === 0 ? 'AAAA' : 'AACA').join(';')
    }

    return {
      format: 'module',
      shortCircuit: true,
      source: [
        ...HEADER,
        ...lines,
        '//# sourceMappingURL=data:application/json;base64,' +
          Buffer.from(JSON.stringify(map)).toString('base64')
      ].join('\n')
    }
  }
})
