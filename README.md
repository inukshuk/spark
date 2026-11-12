spark
=====
The dependency-free test runner for [Electron][electron],
built on [`node:test`][node-test].

Spark runs your unit tests in Electron's main and renderer processes,
with code coverage, test isolation, and Node's reporters.
It works just as well for testing web apps in Chromium.

Spark is the spiritual successor of [electron-mocha][electron-mocha].

[electron]: https://www.electronjs.org
[node-test]: https://nodejs.org/api/test.html
[electron-mocha]: #migrating-from-electron-mocha

Installation
------------
Install `spark-chamber` via NPM.
[Spark chambers][spark-chamber] are for testing electrons!
```sh
npm install --save-dev spark-chamber electron
```
Spark uses the `electron` package of your project,
or the binary at `$ELECTRON_PATH`.

[spark-chamber]: https://en.wikipedia.org/wiki/Spark_chamber

Usage
-----
```js
// test/app.test.js
import assert from 'node:assert/strict'
import process from 'node:process'
import { test } from 'node:test'

test('runs in the Electron main process', () => {
  assert.equal(process.type, 'browser')
})
```

```js
// test/web.test.js
import assert from 'node:assert/strict'
import { platform } from 'node:os'
import process from 'node:process'
import { test } from 'node:test'

test('has Web and Node.js APIs', () => {
  assert.equal(process.type, 'renderer')

  document.body.innerHTML = `<p>${platform()}</p>`
  assert.equal(document.querySelector('p').textContent, platform())
})
```

Run the first in the main process and the second in a renderer:

```sh
npx spark test/app.test.js -r test/web.test.js
```

Files given without `-m` or `-r` run in the main process,
or in the renderer when combined with `--show` or `--url`.
Run `npx spark --help` for all options.

Electron Renderer and Web Apps
------------------------------
Renderer tests run in a hidden window,
with access to Node.js as well as the DOM and Web APIs.
By default the window loads a blank page;
use `--url` to load your own page or app first:

```sh
npx spark --url test/page.html -r 'test/web/**/*.test.js'
npx spark --show -r test/web/app.test.js     # visible window, reload reruns
```

Isolation
---------
By default all test files share one process (`-i none`).
With `-i process` each main process test file runs in its own Electron process,
and each renderer test file in its own window.
Use `-c` to limit concurrency.

Coverage
--------
```sh
npx spark --coverage -m 'test/main/**' -r 'test/renderer/**'
```

Coverage of both processes is merged into a single report.
Test files are excluded by default;
use `--coverage-include` and `--coverage-exclude` to adjust.
If [`NODE_V8_COVERAGE`][v8-coverage] is set,
Spark also writes raw V8 coverage of both processes there,
for tools like [c8][c8].

For code that is compiled ahead of time or on load
(e.g. JSX or TypeScript via [loader hooks][hooks] registered with `--preload`),
enable source maps to report coverage against the original sources:

```sh
NODE_OPTIONS=--enable-source-maps npx spark --coverage ...
```

[v8-coverage]: https://nodejs.org/api/cli.html#node_v8_coveragedir
[c8]: https://github.com/bcoe/c8
[hooks]: https://nodejs.org/api/module.html#customization-hooks

Configuration
-------------
Defaults can be set in the `spark` field of your `package.json`;
command line options take precedence.

```json
{
  "spark": {
    "mainGlobPatterns": ["test/main/**/*.test.js"],
    "rendererGlobPatterns": ["test/renderer/**/*.test.js"],
    "coverageExcludeGlobs": ["test/**"],
    "isolation": "process"
  }
}
```

Reporters
---------
Spark supports Node's [built-in reporters][reporters]
(`spec`, `tap`, `dot`, `junit`, `lcov`),
custom reporter modules,
and two of its own: `sparks` (the default) and `beamline`.

```sh
npx spark -R spec -R lcov -O stdout -O lcov.info test/**/*.test.js
```

Spark's reporters work with `node --test` as well:

```sh
node --test --test-reporter=spark-chamber/reporters/sparks
```

[reporters]: https://nodejs.org/api/test.html#test-reporters

Migrating from electron-mocha
-----------------------------
Spark replaces [electron-mocha][mocha] and Mocha with `node:test`.
With `--ui bdd`, Spark exposes `describe`, `it`, `context`, `specify`
and the `before`/`after` hooks as globals,
so most Mocha test files run unchanged:

```js
// test/main/app.test.js
import assert from 'node:assert/strict'

describe('app', () => {
  before(() => { /* ... */ })

  it('works', () => {
    assert.ok(true)
  })
})
```

Instead of two runs, one for each process:

```sh
electron-mocha --require test/support.js test/main
electron-mocha --renderer --require test/support.js test/renderer
```

run both in one:

```sh
npx spark --ui bdd --preload test/support.js -m test/main -r test/renderer
```

Use `--ui tdd` for Mocha's TDD interface (`suite`, `test`).
See the [`node:test` documentation][node-test-api] for details.

[mocha]: https://github.com/jprichardson/electron-mocha
[node-test-api]: https://nodejs.org/api/test.html

License
-------
MIT
