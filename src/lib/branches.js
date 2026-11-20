import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from './git.js'

/**
 * Deletes only fully merged branches after updating the local base branch.
 * The operation is all-or-nothing: every branch is validated against
 * origin/<base> before the worktree changes, so an unmerged branch aborts the
 * command without deleting anything. The worktree must be clean because the
 * command switches to the base branch and fast-forwards it.
 */
export async function cleanBranches({ config, branches, base, dryRun = false, log }) {
  const repo = config.repoPath
  const baseBranch = String(base ?? config.baseBranch ?? 'develop').trim()
  if (!baseBranch) throw new Error('Specify --base <branch>.')
  const requested = unique(branches.map(branch => String(branch).trim()).filter(Boolean))
  if (requested.length === 0) throw new Error('Specify at least one --branch <name>.')
  if (requested.includes(baseBranch)) throw new Error(`Refusing to delete the base branch ${baseBranch}.`)

  await log?.(`Fetching origin and validating ${requested.length} branch(es) against origin/${baseBranch}.`)
  await git.fetch(repo)
  if (!await git.branchExists(repo, baseBranch)) throw new Error(`Base branch ${baseBranch} does not exist locally.`)
  if (!await git.remoteBranchExists(repo, baseBranch)) throw new Error(`origin/${baseBranch} does not exist.`)

  const blocked = await git.statusBlocking(repo, [])
  if (!dryRun && blocked.length > 0) {
    throw new Error(`The worktree is not clean. Commit, stash, or remove these entries first:\n${blocked.join('\n')}`)
  }

  const current = await git.currentBranch(repo)
  const worktrees = (await git.inspectWorktree(repo)).worktrees
  const plan = []
  for (const branch of requested) {
    const local = await git.branchExists(repo, branch)
    const remote = await git.remoteBranchExists(repo, branch)
    if (!local && !remote) throw new Error(`Branch ${branch} does not exist locally or on origin.`)

    const localMerged = local ? await git.isAncestor(repo, branch, `origin/${baseBranch}`) : null
    if (localMerged === false) {
      throw new Error(`Local branch ${branch} is not fully merged into origin/${baseBranch}; refusing to delete it.`)
    }
    const remoteMerged = remote ? await git.isAncestor(repo, `origin/${branch}`, `origin/${baseBranch}`) : null
    if (remoteMerged === false) {
      throw new Error(`Remote branch origin/${branch} is not fully merged into origin/${baseBranch}; refusing to delete it.`)
    }

    let otherWorktree = null
    for (const entry of worktrees) {
      if (entry.branch === branch && !await samePath(entry.path, repo)) {
        otherWorktree = entry
        break
      }
    }
    if (otherWorktree) {
      throw new Error(`Branch ${branch} is checked out in another worktree at ${otherWorktree.path}; refusing to delete it.`)
    }

    plan.push({
      name: branch,
      local,
      remote,
      localMerged,
      remoteMerged,
      deletedLocal: false,
      deletedRemote: false,
      errors: []
    })
  }

  const result = {
    repo,
    base: baseBranch,
    previousBranch: current,
    worktreeClean: blocked.length === 0,
    blockedEntries: blocked,
    updatedBase: false,
    dryRun,
    branches: plan
  }
  if (dryRun) return result

  if (current !== baseBranch) {
    await log?.(`Switching to ${baseBranch}.`)
    const switched = await git.switchTicketBranch(repo, baseBranch)
    if (!switched.ok) throw new Error(`Could not switch to ${baseBranch}: ${switched.error}`)
  }
  await log?.(`Fast-forwarding ${baseBranch} to origin/${baseBranch}.`)
  const updated = await git.fastForwardCurrent(repo, `origin/${baseBranch}`)
  if (!updated.ok) {
    throw new Error(`Could not fast-forward ${baseBranch} to origin/${baseBranch}: ${updated.error}`)
  }
  result.updatedBase = true

  for (const item of result.branches) {
    if (item.local) {
      item.deletedLocal = await git.deleteLocalBranch(repo, item.name)
      if (!item.deletedLocal) item.errors.push(`Local branch ${item.name} could not be deleted.`)
      else await log?.(`Deleted local branch ${item.name}.`)
    }
    if (item.remote) {
      const remote = await git.deleteRemoteBranch(repo, item.name)
      item.deletedRemote = remote.code === 0
      if (!item.deletedRemote) item.errors.push(`Remote branch origin/${item.name} could not be deleted: ${(remote.stderr || remote.stdout).trim()}`)
      else await log?.(`Deleted remote branch origin/${item.name}.`)
    }
  }
  return result
}

function unique(values) {
  return [...new Set(values)]
}

async function samePath(left, right) {
  const normalize = async value => {
    const resolved = path.resolve(value)
    const real = await fs.realpath(resolved).catch(() => resolved)
    return process.platform === 'win32' ? real.toLowerCase() : real
  }
  return await normalize(left) === await normalize(right)
}
