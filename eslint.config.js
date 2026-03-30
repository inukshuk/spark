import { globalIgnores } from 'eslint/config'
import globals from 'globals'
import standard from 'neostandard'

export default [
  ...standard({
    files: ['**/*.{cjs,js}'],
    noJsx: true
  }),
  {
    files: ['**/*.{cjs,js}'],
    rules: {
      curly: 0,
      'no-var': 0,
      'prefer-const': 0
    }
  },
  {
    files: ['test/**/*.{cjs,js}'],
    languageOptions: {
      globals: {
        ...globals.mocha,
        ...globals.browser
      }
    }
  },
  globalIgnores(['coverage/'])
]
