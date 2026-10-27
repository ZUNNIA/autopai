import path from 'node:path'
import { exists } from './util.js'
import { listSessions } from './session.js'

const PREPARE_KINDS = ['brief', 'backlog']

function normalizeDirectory(directory) {
  const resolved = path.resolve(String(directory ?? ''))
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function prepareSessionPrefix(kind, feature) {
  return `AutopAI ${kind} ${feature}`
}

export function prepareSessionTitleMatches(title, kind, feature) {
  const prefix = prepareSessionPrefix(kind, feature)
  return title === prefix || String(title ?? '').startsWith(`${prefix} [`)
}

/**
 * Builds the state record for a retained prepare session. The title is stored
 * even when the runner cannot resolve an id immediately, so cleanup can retry
 * by the unique title later.
 */
export function prepareSessionRecord({ kind, feature, session, title }) {
  return {
    kind,
    feature,
    id: session?.id ?? null,
    title: session?.title ?? title ?? null,
    createdAt: session?.created ? new Date(session.created).toISOString() : new Date().toISOString()
  }
}

export function mergePrepareSession(records, record) {
  const current = records ?? []
  if (!record) return current
  const existing = current.find(item => item.kind === record.kind
    && ((item.id && record.id && item.id === record.id) || (item.title && record.title && item.title === record.title)))
  if (!existing) return [...current, record]
  return current.map(item => item === existing ? { ...item, ...record } : item)
}

export function isPrepareSession(session) {
  return PREPARE_KINDS.includes(session?.kind)
}

export function prepareSessionsToDelete(state) {
  return (state?.sessions ?? []).filter(isPrepareSession)
}

/**
 * Picks the newest retained brief and backlog sessions for one feature. Only
 * exact titles with the runner token suffix are accepted, so another project
 * or another feature is never attached to the review state.
 */
export function recoverPrepareSessions(sessions, { feature, repoPath }) {
  const target = normalizeDirectory(repoPath)
  const found = new Map()
  for (const session of sessions ?? []) {
    if (!session || normalizeDirectory(session.directory) !== target) continue
    for (const kind of PREPARE_KINDS) {
      if (!prepareSessionTitleMatches(session.title, kind, feature)) continue
      const current = found.get(kind)
      if (!current || Number(session.created ?? 0) > Number(current.created ?? 0)) {
        found.set(kind, {
          kind,
          feature,
          id: session.id ?? null,
          title: session.title,
          createdAt: session.created ? new Date(session.created).toISOString() : null
        })
      }
    }
  }
  return [...found.values()]
}

async function prepareArtifactsExist(config, feature) {
  const backlogDir = path.join(config.repoPath, config.ticketDirs.backlog, feature)
  const [brief, backlog] = await Promise.all([
    exists(path.join(backlogDir, 'brief.md')),
    exists(path.join(backlogDir, 'backlog.md'))
  ])
  return brief && backlog
}

/**
 * Reconnects an interrupted prepare with the conversations that already
 * generated its artifacts. It never starts a session, reloads a core prompt,
 * or approves the backlog; it only restores the review state and session ids.
 */
export async function recoverPrepareReview({ config, stateStore, log, feature = null, sessions = null }) {
  const state = await stateStore.load()
  if (!state || state.mode !== 'prepare' || !state.feature) return null
  if (feature && state.feature !== feature) return null
  if (!['backlog', 'awaiting_approval'].includes(state.phase)) return null
  if (!await prepareArtifactsExist(config, state.feature)) return null

  let records = state.sessions ?? []
  const recovered = recoverPrepareSessions(sessions ?? await listSessions(config), {
    feature: state.feature,
    repoPath: config.repoPath
  })
  for (const session of recovered) records = mergePrepareSession(records, session)

  const completedPhases = [...new Set([...(state.completedPhases ?? []), 'prepare', 'backlog'])]
  const changed = state.phase !== 'awaiting_approval'
    || JSON.stringify(records) !== JSON.stringify(state.sessions ?? [])
    || JSON.stringify(completedPhases) !== JSON.stringify(state.completedPhases ?? [])
  state.sessions = records
  state.phase = 'awaiting_approval'
  state.completedPhases = completedPhases
  if (changed) {
    await stateStore.save(state)
    await log?.(`Prepare review restored for ${state.feature}; no prompt was re-run.`)
  }
  return state
}
