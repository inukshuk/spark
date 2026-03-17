const config = {
  verbose: false
}

export default config

export function configure (opts) {
  for (let key in opts) {
    if (key in config)
      config[key] = opts[key]
  }
}
