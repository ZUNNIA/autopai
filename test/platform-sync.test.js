import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { syncPlatform } from '../src/lib/platform-sync.js'

async function makeFixture(prefix) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `autopai-${prefix}-`))
  const source = path.join(root, 'source')
  const target = path.join(root, 'target')
  await fs.mkdir(path.join(source, 'commands'), { recursive: true })
  await fs.mkdir(path.join(source, 'agents'), { recursive: true })
  await fs.writeFile(path.join(source, 'commands', 'autopai-init.md'), 'init command\n', 'utf8')
  await fs.writeFile(path.join(source, 'agents', 'autopai.md'), 'operator\n', 'utf8')
  await fs.writeFile(path.join(source, 'AGENTS.md'), '# AutopAI rules\n', 'utf8')
  return { root, source, target, agentsSource: path.join(source, 'AGENTS.md') }
}

async function cleanup(root) {
  await fs.rm(root, { recursive: true, force: true })
}

test('platform sync installs commands, agents, and the managed AGENTS block', async t => {
  const fixture = await makeFixture('sync')
  t.after(() => cleanup(fixture.root))
  await fs.mkdir(path.join(fixture.target, 'commands'), { recursive: true })
  await fs.writeFile(path.join(fixture.target, 'commands', 'custom.md'), 'custom\n', 'utf8')

  const report = await syncPlatform(fixture)
  assert.equal(report.created.length, 2)
  assert.equal(report.agents.action, 'created')
  assert.equal(await fs.readFile(path.join(fixture.target, 'commands', 'autopai-init.md'), 'utf8'), 'init command\n')
  assert.equal(await fs.readFile(path.join(fixture.target, 'commands', 'custom.md'), 'utf8'), 'custom\n')
  assert.match(await fs.readFile(path.join(fixture.target, 'AGENTS.md'), 'utf8'), /autopai:begin/)
  assert.equal(await exists(path.join(fixture.target, '.autopai', 'manifest.json')), true)
})

test('platform sync overwrites managed files with a backup and keeps the AGENTS block current', async t => {
  const fixture = await makeFixture('update')
  t.after(() => cleanup(fixture.root))
  await syncPlatform(fixture)
  await fs.writeFile(path.join(fixture.target, 'commands', 'autopai-init.md'), 'local edit\n', 'utf8')
  await fs.writeFile(path.join(fixture.source, 'AGENTS.md'), '# AutopAI rules v2\n', 'utf8')

  const report = await syncPlatform(fixture)
  assert.equal(report.updated.length, 1)
  assert.equal(report.backedUp.length, 2)
  assert.equal(report.agents.action, 'updated')
  assert.equal(await fs.readFile(path.join(fixture.target, 'commands', 'autopai-init.md'), 'utf8'), 'init command\n')
  assert.ok(report.backedUp.some(file => file.endsWith('autopai-init.md')))
  const agents = await fs.readFile(path.join(fixture.target, 'AGENTS.md'), 'utf8')
  assert.match(agents, /AutopAI rules v2/)
  assert.equal(agents.match(/autopai:begin/g).length, 1)
})

test('platform sync migrates an older copy of the rules without duplicating them', async t => {
  const fixture = await makeFixture('migrate')
  t.after(() => cleanup(fixture.root))
  await fs.mkdir(fixture.target, { recursive: true })
  await fs.writeFile(path.join(fixture.target, 'AGENTS.md'), '# AutopAI rules\n\nAn older extra line.\n', 'utf8')

  const report = await syncPlatform(fixture)
  assert.equal(report.agents.action, 'migrated')
  assert.equal(report.backedUp.length, 1)
  const agents = await fs.readFile(path.join(fixture.target, 'AGENTS.md'), 'utf8')
  assert.equal(agents.match(/AutopAI rules/g).length, 1)
  assert.match(agents, /autopai:begin/)
  assert.match(await fs.readFile(report.backedUp[0], 'utf8'), /An older extra line/)
})

test('platform sync preserves custom AGENTS content and appends the managed block', async t => {
  const fixture = await makeFixture('agents')
  t.after(() => cleanup(fixture.root))
  await fs.mkdir(fixture.target, { recursive: true })
  await fs.writeFile(path.join(fixture.target, 'AGENTS.md'), '# custom global rules\n', 'utf8')

  const report = await syncPlatform(fixture)
  assert.equal(report.agents.action, 'appended')
  assert.equal(report.backedUp.length, 1)
  const agents = await fs.readFile(path.join(fixture.target, 'AGENTS.md'), 'utf8')
  assert.match(agents, /# custom global rules/)
  assert.match(agents, /AutopAI rules/)
  assert.match(agents, /autopai:begin/)
})

test('platform sync removes managed files that the source no longer ships', async t => {
  const fixture = await makeFixture('remove')
  t.after(() => cleanup(fixture.root))
  await syncPlatform(fixture)
  await fs.rm(path.join(fixture.source, 'commands', 'autopai-init.md'))

  const report = await syncPlatform(fixture)
  assert.equal(report.removed.length, 1)
  assert.equal(await exists(path.join(fixture.target, 'commands', 'autopai-init.md')), false)
  assert.ok(report.backedUp.some(file => file.endsWith('autopai-init.md')))
})

test('platform sync dry-run writes nothing', async t => {
  const fixture = await makeFixture('dry')
  t.after(() => cleanup(fixture.root))

  const report = await syncPlatform({ ...fixture, dryRun: true })
  assert.equal(report.created.length, 2)
  assert.equal(await exists(path.join(fixture.target, 'commands', 'autopai-init.md')), false)
  assert.equal(await exists(path.join(fixture.target, '.autopai', 'manifest.json')), false)
  assert.equal(await exists(path.join(fixture.target, 'AGENTS.md')), false)
})

test('platform sync runs through the CLI with an explicit target', async t => {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-platform-cli-'))
  t.after(() => cleanup(target))

  const output = execFileSync(
    process.execPath,
    ['src/cli.js', 'platform', 'sync', '--target', target, '--json'],
    { encoding: 'utf8' }
  )
  const report = JSON.parse(output)
  assert.equal(report.target, target)
  assert.ok(report.created.some(file => file.endsWith('autopai-init.md')))
  assert.equal(await exists(path.join(target, '.autopai', 'manifest.json')), true)
})

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}
