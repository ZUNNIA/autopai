import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { cleanBranches } from '../src/lib/branches.js'
import { runBranches } from '../src/phases/branches.js'
import { parseCliArgs } from '../src/lib/util.js'

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

async function createRepository(prefix) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  const remote = path.join(root, 'remote.git')
  const repo = path.join(root, 'repo')
  git(root, ['init', '--bare', '--quiet', remote])
  await fs.mkdir(repo)
  git(repo, ['init', '-b', 'develop', '--quiet'])
  git(repo, ['config', 'user.email', 'test@example.com'])
  git(repo, ['config', 'user.name', 'AutopAI Test'])
  git(repo, ['config', 'commit.gpgsign', 'false'])
  await fs.writeFile(path.join(repo, 'seed.txt'), 'seed\n', 'utf8')
  git(repo, ['add', 'seed.txt'])
  git(repo, ['commit', '--quiet', '-m', 'chore: seed the repository'])
  git(repo, ['remote', 'add', 'origin', remote])
  git(repo, ['push', '-u', 'origin', 'develop'])
  return { root, remote, repo }
}

async function addMergedBranch(repo, branch) {
  git(repo, ['switch', '-c', branch, 'develop'])
  await fs.writeFile(path.join(repo, `${branch.replaceAll('/', '-')}.txt`), `${branch}\n`, 'utf8')
  git(repo, ['add', '.'])
  git(repo, ['commit', '--quiet', '-m', `feat: ${branch}`])
  git(repo, ['push', '-u', 'origin', branch])
  git(repo, ['switch', 'develop'])
  git(repo, ['merge', '--no-ff', branch, '--quiet', '-m', `chore: merge ${branch}`])
  git(repo, ['push', 'origin', 'develop'])
}

test('branches clean deletes a merged local and remote branch and keeps the base', async t => {
  const { root, repo } = await createRepository('autopai-branches-merged-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await addMergedBranch(repo, 'feature/merged')
  git(repo, ['switch', 'feature/merged'])

  const result = await cleanBranches({
    config: { repoPath: repo, baseBranch: 'develop' },
    branches: ['feature/merged']
  })

  assert.equal(result.updatedBase, true)
  assert.equal(result.previousBranch, 'feature/merged')
  assert.equal(result.branches[0].deletedLocal, true)
  assert.equal(result.branches[0].deletedRemote, true)
  assert.equal(result.branches[0].errors.length, 0)
  assert.equal(git(repo, ['branch', '--show-current']).trim(), 'develop')
  assert.equal(git(repo, ['branch', '--list', 'feature/merged']).trim(), '')
  assert.equal(git(repo, ['ls-remote', 'origin', 'refs/heads/feature/merged']).trim(), '')
})

test('branches clean refuses an unmerged branch without deleting anything', async t => {
  const { root, repo } = await createRepository('autopai-branches-unmerged-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  git(repo, ['switch', '-c', 'feature/unmerged', 'develop'])
  await fs.writeFile(path.join(repo, 'unmerged.txt'), 'unmerged\n', 'utf8')
  git(repo, ['add', '.'])
  git(repo, ['commit', '--quiet', '-m', 'feat: unmerged work'])
  git(repo, ['switch', 'develop'])

  await assert.rejects(
    cleanBranches({
      config: { repoPath: repo, baseBranch: 'develop' },
      branches: ['feature/unmerged']
    }),
    /not fully merged/
  )
  assert.match(git(repo, ['branch', '--list', 'feature/unmerged']), /feature\/unmerged/)
})

test('branches clean refuses a dirty worktree but dry-run reports it', async t => {
  const { root, repo } = await createRepository('autopai-branches-dirty-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await addMergedBranch(repo, 'feature/merged')
  await fs.writeFile(path.join(repo, 'untracked.txt'), 'local\n', 'utf8')

  const preview = await cleanBranches({
    config: { repoPath: repo, baseBranch: 'develop' },
    branches: ['feature/merged'],
    dryRun: true
  })
  assert.equal(preview.worktreeClean, false)
  assert.equal(preview.branches[0].deletedLocal, false)
  assert.match(git(repo, ['branch', '--list', 'feature/merged']), /feature\/merged/)

  await assert.rejects(
    cleanBranches({
      config: { repoPath: repo, baseBranch: 'develop' },
      branches: ['feature/merged']
    }),
    /worktree is not clean/
  )
  assert.match(git(repo, ['branch', '--list', 'feature/merged']), /feature\/merged/)
})

test('branches clean handles a local branch whose remote copy is gone', async t => {
  const { root, repo } = await createRepository('autopai-branches-local-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await addMergedBranch(repo, 'feature/merged')
  git(repo, ['push', 'origin', '--delete', 'feature/merged'])

  const result = await cleanBranches({
    config: { repoPath: repo, baseBranch: 'develop' },
    branches: ['feature/merged']
  })

  assert.equal(result.branches[0].deletedLocal, true)
  assert.equal(result.branches[0].remote, false)
  assert.equal(result.branches[0].deletedRemote, false)
})

test('branches clean requires confirmation unless it is a dry-run', async t => {
  const { root, repo } = await createRepository('autopai-branches-confirm-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await addMergedBranch(repo, 'feature/merged')

  await assert.rejects(
    runBranches({
      config: { repoPath: repo, baseBranch: 'develop' },
      options: { _: ['clean'], branch: ['feature/merged'] },
      log: () => {}
    }),
    /requires --confirm/
  )

  const preview = await runBranches({
    config: { repoPath: repo, baseBranch: 'develop' },
    options: { _: ['clean'], branch: ['feature/merged'], dryRun: true },
    log: () => {}
  })
  assert.equal(preview.dryRun, true)
  assert.match(git(repo, ['branch', '--list', 'feature/merged']), /feature\/merged/)
})

test('repeated --branch flags accumulate for the branches command only', () => {
  const branches = parseCliArgs([
    'branches', 'clean',
    '--branch', 'a',
    '--branch', 'b',
    '--confirm'
  ])
  assert.deepEqual(branches.options.branch, ['a', 'b'])

  const adopt = parseCliArgs(['adopt', '--branch', 'topic', '--base', 'develop'])
  assert.equal(adopt.options.branch, 'topic')
})
