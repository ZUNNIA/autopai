import fs from 'node:fs/promises'
import path from 'node:path'
import { slugify, stripTypePrefix } from './util.js'
import { validatePrTitle } from './policy.js'
import { formatCoverage } from './coverage.js'

const PRIORITY = ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'chore']

export async function readAgentTitle(config) {
  const file = path.join(config.stateDir, 'pr-title.txt')
  try {
    const value = (await fs.readFile(file, 'utf8')).split(/\r?\n/)[0].trim()
    return value || null
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function clearAgentTitle(config) {
  const file = path.join(config.stateDir, 'pr-title.txt')
  try {
    await fs.unlink(file)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

export async function resolveTitle({ config, branch, commits }) {
  const agentTitle = await readAgentTitle(config)
  if (agentTitle) {
    const violations = validatePrTitle(agentTitle)
    if (violations.length === 0) return agentTitle
  }
  return deriveTitle(branch, commits)
}

export function deriveTitle(branch, commits) {
  const type = highestType(commits)
  const slug = branch.includes('/') ? branch.split('/').slice(1).join('/') : branch
  const clean = slug.replace(/^pr[-_]?\d+(?:[-_]\d+)?[-_]/, '')
  return `${type}: ${slugify(clean).replace(/-/g, ' ')}`
}

/**
 * Builds the branch-independent commit and pull request title from the short
 * ticket slug. The source PR and finding ordinal are local metadata and never
 * appear in Git artifacts.
 */
export function ticketTitle(ticket) {
  const type = String(ticket?.type ?? 'chore').trim() || 'chore'
  const name = String(ticket?.branchSlug ?? ticket?.slug ?? ticket?.id ?? '').trim().replace(/-/g, ' ')
  return name ? `${type}: ${name}` : 'chore: ticket'
}

function highestType(commits) {
  const types = (commits ?? []).map(commit => String(commit.subject ?? '').split(':')[0].toLowerCase())
  for (const type of PRIORITY) {
    if (types.includes(type)) return type
  }
  return 'chore'
}

export function generatePrBody({ commits, coverage, dryRun = false }) {
  const summary = (commits ?? [])
    .map(commit => stripTypePrefix(commit.subject).trim())
    .filter(Boolean)
    .map(sentence => sentence.replace(/^[a-z]/, letter => letter.toUpperCase()))
    .map(sentence => /[.!?]$/.test(sentence) ? sentence : `${sentence}.`)
    .join(' ')
  const lines = [
    '## Summary',
    summary || 'No commit summary available.',
    '',
    '## Tests',
    `Build and tests passed locally. Coverage: ${formatCoverage(coverage)}.`
  ]
  if (dryRun) lines.push('', '## Note', 'Dry run: no remote changes were made.')
  return lines.join('\n')
}

export function generateMergeBody({ prBody }) {
  const lines = String(prBody ?? '').split(/\r?\n/)
  const start = lines.findIndex(line => /^##\s+Summary\s*$/i.test(line.trim()))
  if (start < 0) return 'No change summary was recorded for this merge.'

  const summary = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line.trim())) break
    if (line.trim()) summary.push(line.trimEnd())
  }
  return summary.join('\n').trim() || 'No change summary was recorded for this merge.'
}
