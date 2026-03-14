import standard from 'neostandard'

export default standard({
  files: [
    'bin/spark',
    '**/*.js'
  ]
}).concat([
  {
    rules: {
      curly: [1, 'multi-or-nest'],
      'no-var': 0,
      'prefer-const': 0,
      '@stylistic/comma-dangle': 0,
      '@stylistic/padded-blocks': 0
    }
  }
])
