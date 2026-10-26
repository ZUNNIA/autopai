import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const agentFile = 'platforms/opencode/agents/autopai.md'
const initCommand = 'platforms/opencode/commands/autopai-init.md'

test('operator edit rules allow the root config and ADR paths without globstar', async () => {
  const text = await fs.readFile(agentFile, 'utf8')
  assert.ok(text.includes('"autopai.json": "allow"'))
  assert.ok(text.includes('"*/autopai.json": "allow"'))
  assert.ok(text.includes('".gitignore": "allow"'))
  assert.ok(text.includes('"tickets/adr/*": "allow"'))
  assert.ok(text.includes('"docs/adr/*": "allow"'))
  assert.ok(!text.includes('"**/autopai.json": "allow"'))
  assert.ok(!text.includes('"**/tickets/adr/**": "allow"'))
})

test('operator shell rules are read-only for git and gh', async () => {
  const text = await fs.readFile(agentFile, 'utf8')
  assert.ok(text.includes('"git status*": "allow"'))
  assert.ok(text.includes('"git diff*": "allow"'))
  assert.ok(text.includes('"git log*": "allow"'))
  assert.ok(text.includes('"gh pr checks*": "allow"'))
  assert.ok(!text.includes('"git *": "allow"'))
  assert.ok(!text.includes('"gh *": "allow"'))
  assert.ok(!text.includes('"git commit'))
  assert.ok(!text.includes('"git push'))
})

test('operator prompt forbids permission bypass with the shell', async () => {
  const agent = await fs.readFile(agentFile, 'utf8')
  const command = await fs.readFile(initCommand, 'utf8')
  assert.match(agent, /Never bypass a denial with shell redirection/)
  assert.match(agent, /Do not write the configuration through the shell/)
  assert.match(command, /Write `autopai\.json` only with the edit tool/)
  assert.match(command, /Never use shell redirection/)
})
