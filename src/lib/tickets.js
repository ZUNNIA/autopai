import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureDir, slugify, walkFiles } from './util.js'

const PRIORITY_ORDER = { urgent: 0, important: 1, minor: 2 }

export async function listTickets(dir) {
  const files = await walkFiles(dir, file => file.endsWith('.md'))
  const tickets = []
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8')
    tickets.push(parseTicket(text, file))
  }
  return tickets.sort((left, right) => left.file.localeCompare(right.file))
}

export function parseTicket(text, file) {
  const match = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  const meta = match ? parseFrontMatter(match[1]) : {}
  const base = path.basename(file, '.md')
  const slug = slugify(base.replace(/^\d+[-_]?/, ''))
  const id = String(meta.id ?? base)
  const type = String(meta.type ?? 'feat')
  const priority = String(meta.priority ?? 'important').toLowerCase()
  const title = String(meta.title ?? firstHeading(text) ?? base)
  return {
    id,
    file,
    slug,
    type,
    priority: PRIORITY_ORDER[priority] == null ? 'important' : priority,
    title,
    feature: meta.feature ? String(meta.feature) : null,
    dependsOn: normalizeList(meta.depends_on ?? meta.dependsOn)
  }
}

function parseFrontMatter(source) {
  const meta = {}
  let currentListKey = null
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (!line.trim() || line.trim().startsWith('#')) continue
    const listItem = line.match(/^\s*-\s+(.+)$/)
    if (listItem && currentListKey) {
      meta[currentListKey] = meta[currentListKey] ?? []
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

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean)
  if (!value) return []
  return String(value)
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function firstHeading(text) {
  const match = String(text).match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}

/**
 * Orders tickets by dependencies and then by business priority. Throws on a
 * dependency cycle or an unknown dependency id.
 */
export function orderTickets(tickets) {
  const byId = new Map()
  const bySlug = new Map()
  for (const ticket of tickets) {
    byId.set(ticket.id, ticket)
    bySlug.set(ticket.slug, ticket)
  }

  const resolved = new Map()
  for (const ticket of tickets) {
    const dependencies = []
    for (const dependency of ticket.dependsOn) {
      const target = byId.get(dependency) ?? bySlug.get(dependency)
      if (!target) throw new Error(`Ticket ${ticket.id} depends on unknown ticket ${dependency}.`)
      dependencies.push(target.id)
    }
    resolved.set(ticket.id, dependencies)
  }

  const ordered = []
  const visiting = new Set()
  const visited = new Set()
  const visit = ticket => {
    if (visited.has(ticket.id)) return
    if (visiting.has(ticket.id)) throw new Error(`Dependency cycle at ticket ${ticket.id}.`)
    visiting.add(ticket.id)
    for (const dependency of resolved.get(ticket.id) ?? []) visit(byId.get(dependency))
    visiting.delete(ticket.id)
    visited.add(ticket.id)
    ordered.push(ticket)
  }

  for (const ticket of [...tickets].sort(compareTickets)) visit(ticket)
  return ordered
}

function compareTickets(left, right) {
  const priority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
  if (priority !== 0) return priority
  return left.file.localeCompare(right.file)
}

export async function moveTicket(ticket, targetDir) {
  await ensureDir(targetDir)
  const target = path.join(targetDir, path.basename(ticket.file))
  await fs.rename(ticket.file, target)
  return target
}

export function branchNameFor(ticket, existingBranches = []) {
  const base = `${ticket.type}/${ticket.slug}`
  if (!existingBranches.includes(base)) return base
  let index = 2
  while (existingBranches.includes(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}
