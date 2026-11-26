import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { mergedPrMatchesHead, validateHead } from '../src/lib/pr.js'
import { logCommits } from '../src/lib/git.js'
import { scanBranch } from '../src/lib/policy.js'

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

test('reuses a merged pull request only when the branch head still matches', () => {
  assert.equal(mergedPrMatchesHead({ headRefOid: 'abc' }, 'abc'), true)
  assert.equal(mergedPrMatchesHead({ headRefOid: 'abc' }, 'def'), false)
  assert.equal(mergedPrMatchesHead({}, 'abc'), false)
  assert.equal(mergedPrMatchesHead({ headRefOid: 'abc' }, null), false)
})

test('validates a release against its base branch instead of the pull request target', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-release-policy-'))
  git(repo, ['init', '-b', 'main', '--quiet'])
  git(repo, ['config', 'user.email', 'test@example.com'])
  git(repo, ['config', 'user.name', 'AutopAI Test'])
  git(repo, ['config', 'commit.gpgsign', 'false'])
  await fs.writeFile(path.join(repo, 'seed.txt'), 'seed\n', 'utf8')
  git(repo, ['add', 'seed.txt'])
  git(repo, ['commit', '--quiet', '-m', 'chore: seed the fixture'])

  git(repo, ['switch', '-c', 'develop'])
  await fs.writeFile(path.join(repo, 'legacy.txt'), 'legacy\n', 'utf8')
  git(repo, ['add', 'legacy.txt'])
  git(repo, ['commit', '--quiet', '-m', 'feat: legacy change', '-m', 'One sentence that references tickets/001-demo.'])

  git(repo, ['switch', '-c', 'chore/release-1-0-0'])
  await fs.writeFile(path.join(repo, 'VERSION'), '1.0.0\n', 'utf8')
  git(repo, ['add', 'VERSION'])
  git(repo, ['commit', '--quiet', '-m', 'chore: release 1.0.0', '-m', 'The manifest records the new version. The changelog keeps the release notes.'])

  git(repo, ['update-ref', 'refs/remotes/origin/main', git(repo, ['rev-parse', 'main']).trim()])
  git(repo, ['update-ref', 'refs/remotes/origin/develop', git(repo, ['rev-parse', 'develop']).trim()])

  const historical = await logCommits(repo, 'origin/main..chore/release-1-0-0')
  assert.ok(historical.some(commit => commit.subject === 'feat: legacy change'))
  assert.ok(scanBranch({ branch: 'chore/release-1-0-0', commits: historical, diff: '' }).some(item => item.code === 'commit-body-sentences'))

  const result = await validateHead({
    config: { repoPath: repo, protectedPaths: [] },
    artifacts: { write: async () => {} },
    baseBranch: 'main',
    policyBaseBranch: 'develop',
    branch: 'chore/release-1-0-0'
  })
  assert.deepEqual(result, { fixed: false, violations: [] })
})
