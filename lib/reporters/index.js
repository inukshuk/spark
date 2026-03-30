import BeamlineReporter from './beamline.js'
import sparks from './sparks.js'

const beamline = (...args) => new BeamlineReporter(...args)

export const reporters = {
  beam: beamline,
  beamline,
  spark: sparks,
  sparks,
}
