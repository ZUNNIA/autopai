import { runCommand } from './runner.js'

async function gh(repo, args, options = {}) {
  const result = await runCommand('gh', args, { cwd: repo, logFile: options.logFile, timeoutMs: options.timeoutMs ?? 120000 })
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
  const args = ['pr', 'create', '--base', base, '--head', head, '--title', title, '--body', body]
  if (draft) args.push('--draft')
  const result = await gh(repo, args)
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
  await gh(repo, ['pr', 'merge', String(number), '--merge', '--subject', title, '--body', body])
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

export function runIdFromUrl(url) {
  const match = String(url ?? '').match(/\/runs\/(\d+)/)
  return match ? match[1] : null
}
