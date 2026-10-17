import test from 'node:test'
import assert from 'node:assert/strict'
import { findForbidden, globToRegExp } from '../src/lib/forbidden.js'

test('matches a protected path list', () => {
  const files = ['.github/workflows/ci.yml', 'AGENTS.md', 'config/client.json', 'src/app.js', 'README.md']
  const patterns = ['.github/**', 'AGENTS.md', 'config/**', '.autopilot.json']
  assert.deepEqual(findForbidden(files, patterns), ['.github/workflows/ci.yml', 'AGENTS.md', 'config/client.json'])
})

test('supports a custom protected list', () => {
  assert.deepEqual(findForbidden(['docs/secret.md', 'src/app.js'], ['docs/**']), ['docs/secret.md'])
})

test('globToRegExp handles single-star and double-star', () => {
  assert.ok(globToRegExp('src/*.js').test('src/app.js'))
  assert.ok(!globToRegExp('src/*.js').test('src/nested/app.js'))
  assert.ok(globToRegExp('src/**').test('src/nested/app.js'))
})
