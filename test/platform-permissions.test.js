import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const agentFile = 'platforms/opencode/agents/autopai.md'
const executorFile = 'platforms/opencode/agents/executor.md'
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
  assert.match(command, /Use `autopai config reconcile --apply` for schema defaults/)
  assert.match(command, /Never use shell redirection/)
})

test('operator cannot read or write outside the repository', async () => {
  const text = await fs.readFile(agentFile, 'utf8')
  assert.match(text, /external_directory: deny/)
  assert.doesNotMatch(text, /external_directory: allow/)
})

test('executor cannot run orchestration commands or change branches', async () => {
  const text = await fs.readFile(executorFile, 'utf8')
  for (const pattern of [
    '"autopai*": "deny"',
    '"opencode*": "deny"',
    '"git push*": "deny"',
    '"git fetch*": "deny"',
    '"git pull*": "deny"',
    '"git checkout*": "deny"',
    '"git switch*": "deny"',
    '"git clean*": "deny"',
    '"git reset*": "deny"',
    '"git branch -D*": "deny"',
    '"git commit --amend*": "deny"',
    '"git add .": "deny"'
  ]) {
    assert.ok(text.includes(pattern), pattern)
  }
})

test('executor cannot write or delete through the shell', async () => {
  const text = await fs.readFile(executorFile, 'utf8')
  for (const pattern of [
    '"Set-Content*": "deny"',
    '"Out-File*": "deny"',
    '"Add-Content*": "deny"',
    '"Clear-Content*": "deny"',
    '"New-Item*": "deny"',
    '"Remove-Item*": "deny"',
    '"del *": "deny"',
    '"rmdir*": "deny"',
    '"powershell -Command*": "deny"',
    '"pwsh -Command*": "deny"'
  ]) {
    assert.ok(text.includes(pattern), pattern)
  }
  assert.match(text, /Never write or delete files through the shell/)
  assert.match(text, /Never run `autopai` or `opencode`/)
})
