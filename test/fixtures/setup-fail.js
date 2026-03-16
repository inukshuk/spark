export function globalSetup () {
  throw new Error('setup failed')
}

export function globalTeardown () {
  console.log('SPARK_TEARDOWN')
}
