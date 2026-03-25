import BeamReporter from './beam.js'
import sparks from './sparks.js'

export const reporters = {
  beam: (...args) => new BeamReporter(...args),
  sparks,
}
