import { runCommand } from './runner.js'

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

export async function statusPorcelain(repo) {
  const result = await git(repo, ['status', '--porcelain'])
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

export async function switchBranch(repo, branch) {
  await git(repo, ['switch', branch])
}

export async function switchBranchSafe(repo, branch) {
  const result = await git(repo, ['switch', branch], { allowFailure: true })
  return result.code === 0
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
