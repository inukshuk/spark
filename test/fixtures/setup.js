import { app } from 'electron'

process.env.SPARK_APP_READY = app.isReady() ? '1' : '0'

export function globalSetup () {
  process.env.SPARK_SETUP = '1'
}

export function globalTeardown () {
  process.env.SPARK_TEARDOWN = '1'
  console.log('SPARK_TEARDOWN')
}
