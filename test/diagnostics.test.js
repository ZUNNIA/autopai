import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDiagnostics, parseSeverities, summarizeDiagnostics } from '../src/lib/diagnostics.js'

test('parses file diagnostics and filters severity', () => {
  const text = [
    'C:\\repo\\A.cs(10,4): warning CS0168: variable declared but never used [C:\\repo\\App.csproj]',
    'C:\\repo\\B.cs(7,2): error CS1002: ; expected [C:\\repo\\App.csproj]',
    'C:\\repo\\C.cs(1,1): info IDE0001: simplify name [C:\\repo\\App.csproj]'
  ].join('\n')
  const diagnostics = parseDiagnostics(text, ['error', 'warning'])
  assert.equal(diagnostics.length, 2)
  assert.deepEqual(diagnostics.map(item => item.severity), ['warning', 'error'])
  assert.equal(diagnostics[0].file, 'C:\\repo\\A.cs')
  assert.equal(diagnostics[0].line, 10)
  assert.equal(diagnostics[0].code, 'CS0168')
  assert.equal(diagnostics[0].project, 'C:\\repo\\App.csproj')
  assert.deepEqual(summarizeDiagnostics(diagnostics), { error: 1, warning: 1, info: 0 })
})

test('accepts tool diagnostics and rejects unknown severities', () => {
  const diagnostics = parseDiagnostics('MSBUILD : warning MSB4011: duplicate import', ['warning'])
  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0].tool, 'MSBUILD')
  assert.throws(() => parseSeverities('error,debug'), /Unknown diagnostic severity/)
})