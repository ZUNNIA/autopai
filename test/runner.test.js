import test from 'node:test'
import assert from 'node:assert/strict'
import { runCommand } from '../src/lib/runner.js'

test('runCommand pipes stdin into the child process', async () => {
  const script = 'let data = ""; process.stdin.on("data", chunk => { data += chunk }); process.stdin.on("end", () => { process.stdout.write(data) })'
  const result = await runCommand('node', ['-e', script], { stdin: 'autopai prompt' })
  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'autopai prompt')
})
