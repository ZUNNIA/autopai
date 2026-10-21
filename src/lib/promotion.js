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
