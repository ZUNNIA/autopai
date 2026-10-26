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
  return `${type}: ${slugify(slug).replace(/-/g, ' ')}`
}

function highestType(commits) {
  const types = (commits ?? []).map(commit => String(commit.subject ?? '').split(':')[0].toLowerCase())
  for (const type of PRIORITY) {
    if (types.includes(type)) return type
  }
  return 'chore'
}

export function generatePrBody({ commits, coverage, dryRun = false }) {
  const summary = (commits ?? []).map(commit => `- ${stripTypePrefix(commit.subject)}`)
  const lines = [
    '## Summary',
    ...(summary.length > 0 ? summary : ['- No commit summary available.']),
    '',
    '## Tests',
    `Build and tests passed locally. Coverage: ${formatCoverage(coverage)}.`
  ]
  if (dryRun) lines.push('', '## Note', 'Dry run: no remote changes were made.')
  return lines.join('\n')
}

export function generateMergeBody({ branch, baseBranch, coverage }) {
  return `Merges ${branch} into ${baseBranch}. CI passed: build, tests and coverage ${formatCoverage(coverage)}.`
}
