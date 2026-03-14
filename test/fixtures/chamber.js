const GASES = {
  neon: { name: 'neon', threshold: 21.6 },
  argon: { name: 'argon', threshold: 15.8 }
}

export function ionize (gas, energy) {
  return (gas in GASES && energy >= GASES[gas].threshold)
    ? {
        particles: Math.floor(energy / GASES[gas].threshold),
        gas: GASES[gas].name
      }
    : null
}

export function detect (trail) {
  return trail?.particles > 0
}
