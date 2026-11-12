// Prints the coverage of compiled (.jsx) files as JSON,
// to compare spark's report with node --test's.
export default async function * (source) {
  for await (let { type, data } of source)
    if (type === 'test:coverage')
      yield JSON.stringify(data.summary.files.filter(f => f.path.endsWith('.jsx'))) + '\n'
}
