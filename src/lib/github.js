import { runCommand } from './runner.js'
import { checkRunIdFromLink } from './ci-failure.js'

const repoNames = new Map()

async function gh(repo, args, options = {}) {
  const result = await runCommand('gh', args, {
    cwd: repo,
    logFile: options.logFile,
    timeoutMs: options.timeoutMs ?? 120000,
    stdin: options.stdin
  })
  if (result.code !== 0 && !options.allowFailure) {
    throw new Error(`gh ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return result
}

function parseJson(text, fallback = null) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return fallback
  return JSON.parse(trimmed)
}

export async function prCreate(repo, { base, head, title, body, draft = false }) {
  const args = ['pr', 'create', '--base', base, '--head', head, '--title', title, '--body-file', '-']
  if (draft) args.push('--draft')
  const result = await gh(repo, args, { stdin: body })
  const url = result.stdout.trim().split(/\r?\n/).find(line => line.startsWith('http')) ?? ''
  const number = Number((url.match(/\/(\d+)$/) ?? [])[1] ?? 0)
  return { url, number }
}

export async function prView(repo, number) {
  const result = await gh(repo, ['pr', 'view', String(number), '--json', 'number,title,state,mergeable,mergeStateStatus,mergeCommit,headRefName,baseRefName,url,isDraft'])
  return parseJson(result.stdout)
}

export async function prChecks(repo, number) {
  const result = await gh(repo, ['pr', 'checks', String(number), '--json', 'name,state,bucket,link'], { allowFailure: true })
  return { ok: result.code === 0, checks: parseJson(result.stdout, []) }
}

async function repoSlug(repo) {
  if (repoNames.has(repo)) return repoNames.get(repo)
  const result = await gh(repo, ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], { allowFailure: true })
  const slug = result.code === 0 ? result.stdout.trim() : ''
  if (slug) repoNames.set(repo, slug)
  return slug
}

export async function prDiff(repo, number) {
  const result = await gh(repo, ['pr', 'diff', String(number)])
  return result.stdout
}

export async function prFiles(repo, number) {
  const result = await gh(repo, ['pr', 'view', String(number), '--json', 'files'])
  const data = parseJson(result.stdout, { files: [] })
  return data.files ?? []
}

export async function prListByHead(repo, head) {
  const result = await gh(repo, ['pr', 'list', '--head', head, '--state', 'all', '--json', 'number,state,url,title,headRefName,baseRefName'])
  return parseJson(result.stdout, [])
}

export async function prListMerged(repo, base, limit) {
  const result = await gh(repo, ['pr', 'list', '--base', base, '--state', 'merged', '--limit', String(limit), '--json', 'number,mergedAt'])
  return parseJson(result.stdout, [])
}

export async function prMerge(repo, number, { title, body }) {
  const args = ['pr', 'merge', String(number), '--merge', '--subject', title]
  const options = {}
  if (body) {
    args.push('--body-file', '-')
    options.stdin = body
  }
  await gh(repo, args, options)
}

export async function prUpdateBranch(repo, number) {
  await gh(repo, ['pr', 'update-branch', String(number)], { allowFailure: true })
}

export async function runFailedLog(repo, check) {
  const runId = runIdFromUrl(check.link ?? '')
  if (!runId) return { ok: false, text: '' }
  const result = await gh(repo, ['run', 'view', String(runId), '--log-failed'], { allowFailure: true })
  const text = (result.stdout || result.stderr).trim()
  const missing = !text || /^log not found\b|^no log available\b/i.test(text)
  return { ok: result.code === 0 && !missing, text }
}

export async function checkAnnotations(repo, check) {
  const checkId = checkRunIdFromLink(check?.link ?? '')
  if (!checkId) return { ok: false, annotations: [], reason: 'The check link has no job id.' }
  const slug = await repoSlug(repo)
  if (!slug) return { ok: false, annotations: [], reason: 'Could not resolve the repository name.' }
  const result = await gh(repo, ['api', `repos/${slug}/check-runs/${checkId}/annotations?per_page=100`], { allowFailure: true })
  if (result.code !== 0) {
    return { ok: false, annotations: [], reason: (result.stderr || result.stdout || 'gh api check-runs annotations failed').trim() }
  }
  try {
    return { ok: true, annotations: parseJson(result.stdout, []) }
  } catch {
    return { ok: false, annotations: [], reason: 'Could not parse check annotations.' }
  }
}

export async function rerunFailedRun(repo, runId) {
  const result = await gh(repo, ['run', 'rerun', String(runId), '--failed'], { allowFailure: true })
  return {
    ok: result.code === 0,
    reason: result.code === 0 ? null : (result.stderr || result.stdout || 'gh run rerun failed').trim()
  }
}

export async function runView(repo, runId) {
  const result = await gh(repo, ['run', 'view', String(runId), '--json', 'status,conclusion,attempt'], { allowFailure: true })
  if (result.code !== 0) return null
  try {
    return parseJson(result.stdout)
  } catch {
    return null
  }
}

export function runIdFromUrl(url) {
  const match = String(url ?? '').match(/\/runs\/(\d+)/)
  return match ? match[1] : null
}
