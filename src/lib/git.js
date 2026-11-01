import path from 'node:path'
import { runCommand } from './runner.js'
import { normalizeCommitMessage } from './commit-message.js'
import { sleep } from './util.js'

async function git(repo, args, options = {}) {
  const result = await runCommand('git', args, { cwd: repo, logFile: options.logFile, timeoutMs: options.timeoutMs ?? 120000 })
  if (result.code !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return result
}

export async function currentBranch(repo) {
  const result = await git(repo, ['branch', '--show-current'])
  return result.stdout.trim()
}

/**
 * Returns the porcelain status of tracked files only. Untracked files such as
 * an uncommitted autopai.json never block a phase, because the orchestrator
 * only guards against modifications of the tracked tree.
 */
export async function statusTrackedPorcelain(repo) {
  const result = await git(repo, ['status', '--porcelain', '--untracked-files=no'])
  return result.stdout.trim()
}

/**
 * Returns the tracked or untracked entries that should block an automated run.
 * Untracked files whose path matches an allowed prefix are ignored so local
 * configuration and ticket directories never block the orchestrator.
 */
export async function statusBlocking(repo, allowedPrefixes = []) {
  const result = await git(repo, ['status', '--porcelain'])
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(line => {
      if (!line.startsWith('??')) return true
      const file = line.slice(3).trim().replace(/^"|"$/g, '')
      return !allowedPrefixes.some(prefix => file === prefix || file.startsWith(prefix))
    })
}

export async function fetch(repo) {
  await git(repo, ['fetch', '--prune', 'origin'])
}

export async function revParse(repo, ref) {
  const result = await git(repo, ['rev-parse', ref])
  return result.stdout.trim()
}

export async function branchExists(repo, branch, remote = false) {
  const ref = remote ? `refs/remotes/origin/${branch}` : `refs/heads/${branch}`
  const result = await git(repo, ['show-ref', '--verify', '--quiet', ref], { allowFailure: true })
  return result.code === 0
}

export async function remoteBranchExists(repo, branch) {
  return branchExists(repo, branch, true)
}

export async function mergeBase(repo, left, right) {
  const result = await git(repo, ['merge-base', left, right])
  return result.stdout.trim()
}

export async function diff(repo, range) {
  const result = await git(repo, ['diff', '--no-ext-diff', range])
  return result.stdout
}

export async function diffNames(repo, range) {
  const result = await git(repo, ['diff', '--name-only', '--no-ext-diff', range])
  return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

export async function countCommitsOver(repo, base, branch) {
  const result = await git(repo, ['rev-list', '--count', `origin/${base}..${branch}`], { allowFailure: true })
  return result.code === 0 ? Number(result.stdout.trim()) : 0
}

export async function logCommits(repo, range) {
  const result = await git(repo, ['log', '--format=%H%x1f%s%x1f%b%x1e', range])
  return result.stdout
    .split('\x1e')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [sha, subject, body = ''] = item.split('\x1f')
      return { sha, subject, body, message: `${subject}\n${body}`.trim() }
    })
}

export async function headCommitMessage(repo) {
  const result = await git(repo, ['log', '-1', '--format=%B'], { allowFailure: true })
  return result.code === 0 ? result.stdout.trimEnd() : null
}

/**
 * Rewrites only the latest commit when its body merely restates the subject.
 * The branch is local at this point; older commits and published history are
 * left untouched.
 */
export async function normalizeHeadCommitMessage({ repoPath, log }) {
  const status = await statusTrackedPorcelain(repoPath)
  if (status) return { changed: false, reason: 'The working tree has tracked changes.' }
  const remotes = await git(repoPath, ['branch', '-r', '--contains', 'HEAD'], { allowFailure: true })
  if (remotes.code === 0 && remotes.stdout.trim()) return { changed: false, reason: 'The commit is already published.' }
  const message = await headCommitMessage(repoPath)
  if (!message) return { changed: false }
  const normalized = normalizeCommitMessage(message)
  if (!normalized.changed) return { changed: false }
  await git(repoPath, ['commit', '--amend', '-m', normalized.message])
  const subject = normalized.message.split(/\r?\n/)[0]
  await log?.(`Removed a duplicate commit body from "${subject}".`)
  return { changed: true, subject }
}

export async function switchBranch(repo, branch) {
  await git(repo, ['switch', branch])
}

/**
 * Classifies a failed checkout so the operator can tell a dirty tree, another
 * worktree and a transient file lock apart from an unknown Git failure.
 */
export function classifySwitchError(message) {
  const text = String(message ?? '').trim()
  if (/local changes|would be overwritten|please commit your changes|please move or remove|overwritten by checkout/i.test(text)) {
    return { kind: 'dirty', retryable: false, action: 'Commit, stash, or discard the tracked changes, then retry.' }
  }
  if (/already checked out|already used by worktree|is already checked out/i.test(text)) {
    return { kind: 'worktree', retryable: false, action: 'Switch or remove the other worktree that owns this branch, then retry.' }
  }
  if (/index\.lock|unable to create .*lock|file exists|being used by another process|permission denied|resource temporarily unavailable|another git process/i.test(text)) {
    return { kind: 'locked', retryable: true, action: 'Close the process holding the repository or file lock, then retry.' }
  }
  if (/invalid reference|not a valid branch|pathspec .* did not match|did not match any file/i.test(text)) {
    return { kind: 'missing', retryable: false, action: 'Recreate the branch or correct the recorded branch name, then retry.' }
  }
  return { kind: 'unknown', retryable: false, action: 'Run git switch manually and report the exact error.' }
}

async function worktreeEntries(repo) {
  const result = await git(repo, ['worktree', 'list', '--porcelain'], { allowFailure: true })
  if (result.code !== 0) return []
  const entries = []
  let current = null
  for (const line of result.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length).trim(), branch: null }
      entries.push(current)
    } else if (current && line.startsWith('branch refs/heads/')) {
      current.branch = line.slice('branch refs/heads/'.length).trim()
    }
  }
  return entries
}

function samePath(left, right) {
  const normalize = value => path.resolve(value).replace(/[\\/]+/g, '/').toLowerCase()
  return normalize(left) === normalize(right)
}

/**
 * Switches to a ticket branch with a clean-tree and worktree preflight. A
 * transient lock is retried once; dirty trees and branches owned by another
 * worktree are never modified automatically.
 */
export async function switchTicketBranch(repo, branch) {
  const current = await currentBranch(repo)
  if (current === branch) return { ok: true, branch }

  const status = await statusTrackedPorcelain(repo)
  if (status) {
    return {
      ok: false,
      branch,
      kind: 'dirty',
      error: `The working tree has tracked changes:\n${status}`,
      action: 'Commit, stash, or discard the tracked changes, then retry.'
    }
  }

  const worktree = (await worktreeEntries(repo)).find(entry => entry.branch === branch && !samePath(entry.path, repo))
  if (worktree) {
    return {
      ok: false,
      branch,
      kind: 'worktree',
      error: `Branch ${branch} is already checked out at ${worktree.path}.`,
      action: 'Switch or remove the other worktree that owns this branch, then retry.'
    }
  }

  const attempt = async () => {
    const result = await git(repo, ['switch', branch], { allowFailure: true })
    if (result.code === 0) return { ok: true, branch }
    const error = (result.stderr || result.stdout || `git switch ${branch} failed`).trim()
    return { ok: false, branch, error, ...classifySwitchError(error) }
  }

  const first = await attempt()
  if (first.ok || !first.retryable) return first
  await sleep(1000)
  return attempt()
}

export async function switchBranchSafe(repo, branch) {
  return (await switchTicketBranch(repo, branch)).ok
}

/**
 * Fast-forwards a local branch from origin with a refspec. The fetch refuses
 * non-fast-forward updates, so local commits are never overwritten.
 */
export async function syncLocalBranch(repo, branch) {
  const result = await git(repo, ['fetch', 'origin', `${branch}:${branch}`], { allowFailure: true })
  return result.code === 0
}

export async function deleteLocalBranch(repo, branch) {
  const result = await git(repo, ['branch', '-d', branch], { allowFailure: true })
  return result.code === 0
}

export async function createBranchFrom(repo, branch, base) {
  await git(repo, ['switch', '-c', branch, `origin/${base}`])
}

export async function push(repo, branch) {
  await git(repo, ['push', '-u', 'origin', branch])
}

export async function deleteRemoteBranch(repo, branch) {
  await git(repo, ['push', 'origin', '--delete', branch], { allowFailure: true })
}

export async function listLocalBranches(repo) {
  const result = await git(repo, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
  return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

export async function tag(repo, name, ref = 'HEAD') {
  await git(repo, ['tag', name, ref])
}

export async function pushTag(repo, name) {
  await git(repo, ['push', 'origin', name])
}
