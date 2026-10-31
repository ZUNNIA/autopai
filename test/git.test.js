import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { normalizeHeadCommitMessage, statusTrackedPorcelain } from '../src/lib/git.js'

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

test('statusTrackedPorcelain ignores untracked files and reports tracked changes', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-git-'))
  git(repo, ['init', '--quiet'])
  await fs.writeFile(path.join(repo, 'tracked.txt'), 'one\n', 'utf8')
  git(repo, ['add', 'tracked.txt'])
  git(repo, ['-c', 'user.email=test@example.com', '-c', 'user.name=AutopAI Test', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'chore: seed the test repository'])

  assert.equal(await statusTrackedPorcelain(repo), '')

  await fs.writeFile(path.join(repo, 'untracked.txt'), 'junk\n', 'utf8')
  assert.equal(await statusTrackedPorcelain(repo), '')

  await fs.writeFile(path.join(repo, 'tracked.txt'), 'two\n', 'utf8')
  assert.equal((await statusTrackedPorcelain(repo)).trim(), 'M tracked.txt')
})

test('normalizes a duplicate commit body on the latest commit', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-git-message-'))
  git(repo, ['init', '--quiet'])
  await fs.writeFile(path.join(repo, 'tracked.txt'), 'one\n', 'utf8')
  git(repo, ['add', 'tracked.txt'])
  git(repo, [
    '-c', 'user.email=test@example.com',
    '-c', 'user.name=AutopAI Test',
    '-c', 'commit.gpgsign=false',
    'commit', '--quiet', '-m', 'refactor: gen panel context section',
    '-m', 'Gen panel context section.'
  ])

  const result = await normalizeHeadCommitMessage({ repoPath: repo })
  assert.equal(result.changed, true)
  assert.equal(git(repo, ['log', '-1', '--format=%B']).trim(), 'refactor: gen panel context section')
})
