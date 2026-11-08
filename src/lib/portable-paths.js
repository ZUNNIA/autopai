import path from 'node:path'

/**
 * Converts an absolute path to a forward-slash path relative to the repository.
 * Returns null when the target is on another volume and no relative form exists.
 */
export function toRepoRelative(repoPath, target) {
  if (!target) return target ?? null
  const relative = path.relative(repoPath, target)
  if (relative === '') return '.'
  if (path.isAbsolute(relative)) return null
  return relative.split(path.sep).join('/')
}

/**
 * Resolves a persisted repository-relative path. Absolute values are accepted
 * for backward compatibility with state written before portable paths.
 */
export function fromRepoRelative(repoPath, value) {
  if (!value) return value ?? null
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(repoPath, value)
}

/**
 * Creates the persisted form of run state. Runtime objects may keep absolute
 * paths, but state.json never stores machine-specific file locations.
 */
export function portableState(state, repoPath) {
  if (!state || typeof state !== 'object') return state
  const next = { ...state }
  if (typeof next.repo === 'string') next.repo = '.'
  if (Array.isArray(next.scopes)) {
    next.scopes = next.scopes.map(scope => {
      if (!scope || typeof scope !== 'object') return scope
      return {
        ...scope,
        patch: scope.patch ? toRepoRelative(repoPath, scope.patch) ?? scope.patch : scope.patch,
        tickets: Array.isArray(scope.tickets)
          ? scope.tickets.map(ticket => toRepoRelative(repoPath, ticket) ?? ticket)
          : scope.tickets
      }
    })
  }
  if (Array.isArray(next.blockers)) {
    next.blockers = next.blockers.map(blocker =>
      typeof blocker === 'string' ? toRepoRelative(repoPath, blocker) ?? blocker : blocker
    )
  }
  return next
}
