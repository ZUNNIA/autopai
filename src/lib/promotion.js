/**
 * Returns the finding groups recorded by the current identify or promotion
 * state, or null when the caller must fall back to the identified directory.
 * An empty array is a real result: a filtered audit that found nothing must not
 * make promotion walk older findings.
 */
export function stateFindingGroups(state) {
  const scopes = Array.isArray(state?.scopes) ? state.scopes : []
  if (scopes.length === 0) return null
  if (state.mode !== 'identify' && state.mode !== 'promote') return null
  return scopes.map(scope => ({
    name: String(scope.name),
    findings: (scope.tickets ?? []).filter(file => String(file).endsWith('.md'))
  }))
}

/**
 * Selects the audit chunks whose promotion still has work. An explicit chunk
 * must exist, and chunks already recorded as promoted are skipped, so an
 * interrupted promotion resumes without redoing finished work.
 */
export function selectPromotionGroups(groups, { chunk, completedPhases = [] } = {}) {
  if (chunk === true) throw new Error('The --chunk option requires a chunk name.')
  const available = groups.map(group => group.name)
  if (chunk && !available.includes(chunk)) {
    throw new Error(`Unknown promotion chunk: ${chunk}. Available chunks: ${available.join(', ')}.`)
  }

  const done = new Set(
    completedPhases
      .filter(phase => String(phase).startsWith('promote:'))
      .map(phase => String(phase).slice('promote:'.length))
  )

  return groups.filter(group => (!chunk || group.name === chunk) && !done.has(group.name))
}
