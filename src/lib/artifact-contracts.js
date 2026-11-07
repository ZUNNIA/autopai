import fs from 'node:fs/promises'
import { validateBillingText } from './billing.js'
import { normalizeClassification, normalizePriority, parseClassification, parsePriority } from './filters.js'

const TICKET_TYPES = ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore']
const PRIORITIES = ['urgent', 'important', 'minor']

export function validateBriefText(text, { file = '<memory>' } = {}) {
  rejectOpenQuestions(text, file)
  requireSections(text, file, ['Problem', 'Scope', 'Non-goals', 'Constraints', 'Acceptance Criteria', 'External References'])
  return { file, kind: 'brief' }
}

export function validateBacklogText(text, { file = '<memory>' } = {}) {
  rejectOpenQuestions(text, file)
  requireSections(text, file, ['0. Classification', '1. Objective', '2. Work Organization', '3. Golden Rules for a Backlog'])
  if (!/^###\s+\d+:\s+\S+/m.test(text)) throw contractError(file, 'the backlog must contain at least one "### <n>: <task>" block.')
  if (!/^####\s+Subtasks:\s*$/m.test(text)) throw contractError(file, 'the backlog must contain a "#### Subtasks:" block.')
  validateBillingText(text, { file })
  return { file, kind: 'backlog' }
}

export function validateFindingText(text, { file = '<memory>' } = {}) {
  rejectOpenQuestions(text, file)
  requireSections(text, file, ['0. Classification', '1. Objective', '2. Evidence', '3. Impact', '4. References'])
  if (!parseClassification(text)) throw contractError(file, 'the finding must check exactly one debt classification.')
  if (!parsePriority(text)) throw contractError(file, 'the finding must check exactly one priority.')
  validateBillingText(text, { file })
  return { file, kind: 'identified' }
}

export function validateReadyForDevText(text, { file = '<memory>' } = {}) {
  const meta = requireFrontMatter(text, file)
  requireFields(meta, file, ['id', 'feature', 'type', 'priority', 'billing', 'depends_on'])
  requireTicketType(meta, file)
  requirePriority(meta, file)
  const qaFix = /^#{1,6}\s*1\.\s*QA Failure\b/im.test(String(text ?? ''))
  requireSections(text, file, qaFix
    ? ['0. Classification', '1. QA Failure', '2. Files', '3. Implementation', '4. Acceptance Criteria', '5. Manual Verification']
    : ['0. Classification', '1. Objective', '2. Files', '3. Implementation', '4. Acceptance Criteria', '5. Technical Notes', '6. Manual Verification'])
  validateBillingText(text, { file })
  return { file, kind: qaFix ? 'qa-fix' : 'ready-for-dev' }
}

export function validateReadyForRefactorText(text, { file = '<memory>' } = {}) {
  const meta = requireFrontMatter(text, file)
  requireFields(meta, file, ['id', 'feature', 'type', 'classification', 'priority', 'billing', 'depends_on'])
  if (String(meta.type).trim() !== 'refactor') throw contractError(file, 'ready-for-refactor tickets must use "type: refactor".')
  if (!normalizeClassification(meta.classification)) throw contractError(file, 'ready-for-refactor tickets must declare a valid classification.')
  requirePriority(meta, file)
  requireSections(text, file, ['0. Classification', '1. Objective', '2. Files', '3. Refactoring Strategy', '4. Risk Mitigation Plan', '5. Acceptance Criteria', '6. Technical Notes and Design Decisions'])
  validateBillingText(text, { file })
  return { file, kind: 'ready-for-refactor' }
}

export function validateQaFixText(text, { file = '<memory>' } = {}) {
  const meta = requireFrontMatter(text, file)
  requireFields(meta, file, ['id', 'feature', 'type', 'priority', 'billing', 'depends_on'])
  if (String(meta.type).trim() !== 'fix') throw contractError(file, 'QA fix tickets must use "type: fix".')
  requirePriority(meta, file)
  requireSections(text, file, ['0. Classification', '1. QA Failure', '2. Files', '3. Implementation', '4. Acceptance Criteria', '5. Manual Verification'])
  validateBillingText(text, { file })
  return { file, kind: 'qa-fix' }
}

export function validateUxProposalText(text, { file = '<memory>' } = {}) {
  rejectOpenQuestions(text, file)
  requireSections(text, file, ['Context', 'Observation', 'Impact', 'Proposal', 'Alternatives'])
  return { file, kind: 'ux' }
}

export async function validateArtifactFiles(files, kind) {
  const validators = {
    brief: validateBriefText,
    backlog: validateBacklogText,
    identified: validateFindingText,
    'ready-for-dev': validateReadyForDevText,
    'ready-for-refactor': validateReadyForRefactorText,
    'qa-fix': validateQaFixText,
    ux: validateUxProposalText
  }
  const validate = validators[kind]
  if (!validate) throw new Error(`Unknown artifact kind: ${kind}`)

  const reports = []
  for (const file of files) {
    reports.push(validate(await fs.readFile(file, 'utf8'), { file }))
  }
  return reports
}

function requireSections(text, file, sections) {
  for (const section of sections) {
    if (!hasSection(text, section)) throw contractError(file, `missing required section "## ${section}".`)
  }
}

function hasSection(text, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^#{1,6}\\s*${escaped}\\b`, 'im').test(String(text ?? ''))
}

function rejectOpenQuestions(text, file) {
  if (/^#{1,6}\s*(?:\d+\.\s*)?Open Questions\b/im.test(String(text ?? ''))) {
    throw contractError(file, 'open questions are forbidden in generated artifacts; keep them in the final chat message.')
  }
}

function requireFrontMatter(text, file) {
  const match = String(text ?? '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) throw contractError(file, 'missing YAML front matter.')
  return parseFrontMatter(match[1])
}

function parseFrontMatter(source) {
  const meta = {}
  let currentListKey = null
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (!line.trim() || line.trim().startsWith('#')) continue
    const listItem = line.match(/^\s*-\s+(.+)$/)
    if (listItem && currentListKey) {
      meta[currentListKey] = Array.isArray(meta[currentListKey]) ? meta[currentListKey] : []
      meta[currentListKey].push(listItem[1].trim())
      continue
    }
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!pair) continue
    const [, key, value] = pair
    if (value === '') {
      currentListKey = key
      meta[key] = []
    } else {
      currentListKey = null
      meta[key] = value.trim()
    }
  }
  return meta
}

function requireFields(meta, file, fields) {
  for (const field of fields) {
    if (!(field in meta) || meta[field] === '') throw contractError(file, `front matter is missing "${field}".`)
  }
}

function requireTicketType(meta, file) {
  const value = String(meta.type ?? '').trim()
  if (!TICKET_TYPES.includes(value)) {
    throw contractError(file, `invalid ticket type "${value}". Use ${TICKET_TYPES.join(', ')}.`)
  }
}

function requirePriority(meta, file) {
  const value = normalizePriority(meta.priority)
  if (!value || !PRIORITIES.includes(value)) {
    throw contractError(file, `invalid priority "${String(meta.priority ?? '')}". Use ${PRIORITIES.join(', ')}.`)
  }
}

function contractError(file, message) {
  return new Error(`${file}: ${message}`)
}
