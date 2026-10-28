import { slugify } from './util.js'

export const CLASSIFICATIONS = [
  'code-smell',
  'unnecessary-complexity',
  'lack-of-coverage',
  'outdated-library',
  'architecture',
  'missing-documentation'
]

export const PRIORITIES = ['urgent', 'important', 'minor']

const CLASSIFICATION_LABELS = {
  'code-smell': 'Code Smell',
  'unnecessary-complexity': 'Unnecessary Complexity',
  'lack-of-coverage': 'Lack of Coverage',
  'outdated-library': 'Outdated Library',
  architecture: 'Architecture',
  'missing-documentation': 'Missing Documentation'
}

const CLASSIFICATION_ALIASES = new Map([
  ['code-smell', 'code-smell'],
  ['code-smells', 'code-smell'],
  ['codesmell', 'code-smell'],
  ['unnecessary-complexity', 'unnecessary-complexity'],
  ['complexity', 'unnecessary-complexity'],
  ['overcomplicated', 'unnecessary-complexity'],
  ['lack-of-coverage', 'lack-of-coverage'],
  ['coverage', 'lack-of-coverage'],
  ['lack-of-tests', 'lack-of-coverage'],
  ['tests', 'lack-of-coverage'],
  ['falta-de-cobertura', 'lack-of-coverage'],
  ['cobertura', 'lack-of-coverage'],
  ['outdated-library', 'outdated-library'],
  ['outdated-libraries', 'outdated-library'],
  ['outdated', 'outdated-library'],
  ['library', 'outdated-library'],
  ['libraries', 'outdated-library'],
  ['dependencia-obsoleta', 'outdated-library'],
  ['dependencias-obsoletas', 'outdated-library'],
  ['architecture', 'architecture'],
  ['arch', 'architecture'],
  ['arquitectura', 'architecture'],
  ['missing-documentation', 'missing-documentation'],
  ['documentation', 'missing-documentation'],
  ['documentacion', 'missing-documentation'],
  ['documentacion-faltante', 'missing-documentation'],
  ['falta-de-documentacion', 'missing-documentation']
])

const PRIORITY_ALIASES = new Map([
  ['urgent', 'urgent'],
  ['urgente', 'urgent'],
  ['critical', 'urgent'],
  ['critica', 'urgent'],
  ['critico', 'urgent'],
  ['important', 'important'],
  ['importante', 'important'],
  ['high', 'important'],
  ['alta', 'important'],
  ['alto', 'important'],
  ['minor', 'minor'],
  ['menor', 'minor'],
  ['low', 'minor'],
  ['baja', 'minor'],
  ['bajo', 'minor']
])

/**
 * Normalizes one classification value. Unknown values return null so a legacy
 * ticket without a classification never matches an explicit filter.
 */
export function normalizeClassification(value) {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined || raw === null || raw === true || String(raw).trim() === '') return null
  return CLASSIFICATION_ALIASES.get(slugify(raw)) ?? null
}

export function normalizePriority(value) {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined || raw === null || raw === true || String(raw).trim() === '') return null
  return PRIORITY_ALIASES.get(slugify(raw)) ?? null
}

export function normalizeClassificationList(value) {
  return normalizeList(value, normalizeClassification, 'classification', CLASSIFICATIONS)
}

export function normalizePriorityList(value) {
  return normalizeList(value, normalizePriority, 'priority', PRIORITIES)
}

function normalizeList(value, normalize, label, allowed) {
  if (value === undefined || value === null || value === false) return []
  if (value === true) throw new Error(`A ${label} filter needs a value. Use: ${allowed.join(', ')}.`)

  if (Array.isArray(value) && value.length === 0) return []

  const values = (Array.isArray(value) ? value : [value])
    .flatMap(item => String(item).split(','))
    .map(item => item.trim())
    .filter(Boolean)

  if (values.length === 0) throw new Error(`A ${label} filter needs a value. Use: ${allowed.join(', ')}.`)

  const normalized = []
  for (const item of values) {
    const result = normalize(item)
    if (!result) throw new Error(`Unknown ${label}: ${item}. Use: ${allowed.join(', ')}.`)
    normalized.push(result)
  }
  return [...new Set(normalized)]
}

/**
 * Accepts either CLI option keys or already-normalized state keys and returns
 * canonical arrays. Empty arrays mean no filter on that dimension.
 */
export function normalizeFilters(input = {}) {
  return {
    classifications: normalizeClassificationList(input.classifications ?? input.classification),
    priorities: normalizePriorityList(input.priorities ?? input.priority)
  }
}

export function hasFilters(filters) {
  return (filters?.classifications?.length ?? 0) > 0 || (filters?.priorities?.length ?? 0) > 0
}

export function matchesFilters(ticket, filters) {
  const classifications = filters?.classifications ?? []
  const priorities = filters?.priorities ?? []
  if (classifications.length > 0 && !classifications.includes(ticket?.classification)) return false
  if (priorities.length > 0 && !priorities.includes(ticket?.priority)) return false
  return true
}

export function filterTickets(tickets, filters) {
  if (!hasFilters(filters)) return [...(tickets ?? [])]
  return (tickets ?? []).filter(ticket => matchesFilters(ticket, filters))
}

export function describeFilters(filters) {
  const parts = []
  if (filters?.classifications?.length) parts.push(`classification=${filters.classifications.join('|')}`)
  if (filters?.priorities?.length) parts.push(`priority=${filters.priorities.join('|')}`)
  return parts.join(', ')
}

/**
 * Reads the checked classification from a Markdown debt document. The labels
 * are language-independent English names used by the auditor and the planner.
 */
export function parseClassification(text) {
  const pattern = new RegExp(
    `^\\s*[-*]\\s*\\[[xX]\\]\\s*.*?\\*\\*\\s*(${Object.values(CLASSIFICATION_LABELS).join('|')})\\s*:?\\s*\\*\\*`,
    'im'
  )
  const match = String(text ?? '').match(pattern)
  return match ? normalizeClassification(match[1]) : null
}

export function parsePriority(text) {
  const pattern = /^\s*[-*]\s*\[[xX]\]\s*.*?\*\*\s*(Urgent|Important|Minor)\s*:?\s*\*\*/im
  const match = String(text ?? '').match(pattern)
  return match ? normalizePriority(match[1]) : null
}
