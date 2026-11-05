import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ensureDir } from '../lib/util.js'

export async function writePromptFile(logFile, promptText) {
  const file = `${String(logFile).replace(/\.log$/, '')}.prompt.md`
  await ensureDir(path.dirname(file))
  await fs.writeFile(file, promptText, 'utf8')
  return file
}

export function uniqueSessionTitle(title) {
  return `${title} [${randomUUID().slice(0, 8)}]`
}

export function normalizeDirectory(directory) {
  const normalized = String(directory ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

export function pickSessionToDelete(sessions, { title, directory, since }) {
  const target = normalizeDirectory(directory)
  const matches = (sessions ?? []).filter(session => session
    && session.title === title
    && normalizeDirectory(session.directory) === target
    && Number(session.created ?? session.updated ?? 0) >= since)
  return matches.length === 1 ? matches[0] : null
}

export function normalizeSession(session) {
  if (!session || typeof session !== 'object') return null
  return {
    id: session.id ?? null,
    title: session.title ?? null,
    directory: session.directory ?? null,
    created: session.created ?? session.createdAt ?? session.updated ?? null
  }
}
