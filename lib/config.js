const config = {
  coverageExcludeGlobs: undefined,
  coverageIncludeGlobs: undefined,
  show: false,
  url: 'spark://chamber',
  verbose: false
}

export default config

export function configure (opts) {
  for (let key in opts) {
    if (key in config)
      config[key] = opts[key]
  }
}
