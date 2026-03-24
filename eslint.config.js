import globals from 'globals'
import standard from 'neostandard'

export default standard({
  files: [
    'bin/spark',
    '**/*.js'
  ]
}).concat([
  {
    rules: {
      camelcase: 0,
      curly: 0,
      'no-ex-assign': 0,
      'no-var': 0,
      'prefer-const': 0,
      '@stylistic/comma-dangle': 0,
      '@stylistic/padded-blocks': 0
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: globals.mocha
    }
  }
])
