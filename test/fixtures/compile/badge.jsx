export function badge (count) {
  if (count > 9) {
    return h('b', null, '9+')
  }

  return h('b', null, String(count))
}
