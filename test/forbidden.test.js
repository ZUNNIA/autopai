import test from 'node:test'
import assert from 'node:assert/strict'
import { findForbidden, globToRegExp } from '../src/lib/forbidden.js'

test('matches the default protected paths', () => {
  const files = ['.github/workflows/ci.yml', 'AGENTS.md', 'opencode.json', 'src/app.js', 'README.md']
  const patterns = ['.github/**', 'AGENTS.md', 'opencode.json', 'opencode.jsonc', '.autopilot.json']
  assert.deepEqual(findForbidden(files, patterns), ['.github/workflows/ci.yml', 'AGENTS.md', 'opencode.json'])
})

test('supports a custom protected list', () => {
  assert.deepEqual(findForbidden(['docs/secret.md', 'src/app.js'], ['docs/**']), ['docs/secret.md'])
})

test('globToRegExp handles single-star and double-star', () => {
  assert.ok(globToRegExp('src/*.js').test('src/app.js'))
  assert.ok(!globToRegExp('src/*.js').test('src/nested/app.js'))
  assert.ok(globToRegExp('src/**').test('src/nested/app.js'))
})
