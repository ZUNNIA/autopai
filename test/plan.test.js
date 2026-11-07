import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const cli = path.resolve('src/cli.js')

test('plan propose records the agreed summary without generating artifacts', async () => {
  const repo = await makeRepo()
  const output = execFileSync(process.execPath, [
    cli,
    'plan',
    'propose',
    '--repo',
    repo,
    '--feature',
    'demo-feature',
    '--description',
    'Add a search field with an empty state.'
  ], { encoding: 'utf8' })

  assert.match(output, /Plan proposal:/)
  const proposal = JSON.parse(await fs.readFile(path.join(repo, '.autopai', 'plan-proposal.json'), 'utf8'))
  assert.equal(proposal.feature, 'demo-feature')
  assert.equal(proposal.description, 'Add a search field with an empty state.')
  assert.equal(await exists(path.join(repo, 'tickets', 'backlog')), false)
})

test('plan generate requires an explicit confirmation', async () => {
  const repo = await makeRepo()
  execFileSync(process.execPath, [
    cli,
    'plan',
    'propose',
    '--repo',
    repo,
    '--feature',
    'demo-feature',
    '--description',
    'Add a search field.'
  ])

  const result = spawnSync(process.execPath, [
    cli,
    'plan',
    'generate',
    '--repo',
    repo,
    '--feature',
    'demo-feature'
  ], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires --confirm/)
})

async function makeRepo() {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-plan-'))
  await fs.writeFile(path.join(repo, 'autopai.json'), `${JSON.stringify({
    runner: 'opencode',
    baseBranch: 'main',
    releaseBranch: 'main',
    pauseAfter: []
  }, null, 2)}\n`, 'utf8')
  return repo
}

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}
