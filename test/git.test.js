import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { classifySwitchError, normalizeHeadCommitMessage, statusTrackedPorcelain, switchTicketBranch } from '../src/lib/git.js'

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

test('classifies common branch switch failures', () => {
  assert.equal(classifySwitchError('Your local changes would be overwritten by checkout').kind, 'dirty')
  assert.equal(classifySwitchError('branch is already used by worktree at C:/repo').kind, 'worktree')
  assert.equal(classifySwitchError('Unable to create .git/index.lock: File exists').kind, 'locked')
  assert.equal(classifySwitchError('pathspec did not match any file(s) known to git').kind, 'missing')
  assert.equal(classifySwitchError('something unexpected').kind, 'unknown')
})

test('refuses a branch switch when the tracked working tree is dirty', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-switch-'))
  git(repo, ['init', '--quiet'])
  git(repo, ['config', 'user.email', 'test@example.com'])
  git(repo, ['config', 'user.name', 'AutopAI Test'])
  await fs.writeFile(path.join(repo, 'tracked.txt'), 'one\n', 'utf8')
  git(repo, ['add', 'tracked.txt'])
  git(repo, ['commit', '--quiet', '-m', 'chore: seed'])
  await fs.writeFile(path.join(repo, 'tracked.txt'), 'two\n', 'utf8')

  const result = await switchTicketBranch(repo, 'refactor/other')
  assert.equal(result.ok, false)
  assert.equal(result.kind, 'dirty')
  assert.match(result.action, /Commit, stash, or discard/)
})

test('reports the exact git error for a missing branch', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-switch-missing-'))
  git(repo, ['init', '--quiet'])
  git(repo, ['config', 'user.email', 'test@example.com'])
  git(repo, ['config', 'user.name', 'AutopAI Test'])
  await fs.writeFile(path.join(repo, 'tracked.txt'), 'one\n', 'utf8')
  git(repo, ['add', 'tracked.txt'])
  git(repo, ['commit', '--quiet', '-m', 'chore: seed'])

  const result = await switchTicketBranch(repo, 'refactor/missing')
  assert.equal(result.ok, false)
  assert.equal(result.kind, 'missing')
  assert.match(result.error, /refactor\/missing/)
})

test('normalizes a duplicate commit body on the latest commit', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-git-message-'))
  git(repo, ['init', '--quiet'])
  git(repo, ['config', 'user.email', 'test@example.com'])
  git(repo, ['config', 'user.name', 'AutopAI Test'])
  git(repo, ['config', 'commit.gpgsign', 'false'])
  await fs.writeFile(path.join(repo, 'tracked.txt'), 'one\n', 'utf8')
  git(repo, ['add', 'tracked.txt'])
  git(repo, ['commit', '--quiet', '-m', 'refactor: gen panel context section', '-m', 'Gen panel context section.'])

  const result = await normalizeHeadCommitMessage({ repoPath: repo })
  assert.equal(result.changed, true)
  assert.equal(git(repo, ['log', '-1', '--format=%B']).trim(), 'refactor: gen panel context section')
})
