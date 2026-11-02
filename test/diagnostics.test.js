import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseDiagnostics, parseSeverities, runBuildDiagnostics, summarizeDiagnostics } from '../src/lib/diagnostics.js'
import { diagnosticsBranchName } from '../src/phases/diagnostics.js'

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
const restoreWarning = String.raw`C:\repo\AsistenteVirtual.csproj : warning NU1902: vulnerable package [C:\repo\AsistenteVirtual.sln]`
const buildError = String.raw`C:\repo\A.cs(2,3): error CS1002: ; expected [C:\repo\AsistenteVirtual.csproj]`

test('parses NuGet restore project diagnostics', () => {
  const diagnostics = parseDiagnostics(restoreWarning, ['warning'])
  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0].code, 'NU1902')
  assert.equal(diagnostics[0].file, String.raw`C:\repo\AsistenteVirtual.csproj`)
  assert.equal(diagnostics[0].project, String.raw`C:\repo\AsistenteVirtual.sln`)
  assert.equal(diagnostics[0].line, null)
})

test('parses bare diagnostics without a file', () => {
  const diagnostics = parseDiagnostics('warning NU1903: high severity package', ['warning'])
  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0].code, 'NU1903')
  assert.equal(diagnostics[0].file, null)
})

test('combines restore and build diagnostics', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-diagnostics-'))
  const result = await runBuildDiagnostics({
    config: {
      repoPath: repo,
      restoreCommand: [process.execPath, '-e', `console.log(${JSON.stringify(restoreWarning)})`],
      buildCommand: [process.execPath, '-e', `console.log(${JSON.stringify(buildError)})`],
      commandTimeoutMinutes: 1
    },
    severities: ['error', 'warning']
  })
  assert.equal(result.exitCode, 0)
  assert.equal(result.diagnostics.length, 2)
  assert.deepEqual(result.summary, { error: 1, warning: 1, info: 0 })
  assert.ok(result.diagnostics.some(item => item.code === 'NU1902'))
})

test('uses a unique diagnostics branch name within the policy limit', () => {
  const first = diagnosticsBranchName(1700000000000)
  const second = diagnosticsBranchName(1700000000001)
  assert.match(first, /^chore\/diagnostics-[0-9a-z]+$/)
  assert.notEqual(first, second)
  assert.ok(first.length <= 32)
})
