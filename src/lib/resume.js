import { DEFAULT_PAUSE_AFTER, currentGate, gateLabel, phaseAfterGate } from './pauses.js'

const RESUMABLE = new Set(['adopt', 'prepare', 'dev', 'refactor', 'identify', 'promote'])

/**
 * Decides what `resume` does from the stored state: continue the interrupted
 * phase, advance to the next local phase when the last one completed, or stop
 * at a human gate. A paused gate never advances on its own; the caller must
 * approve that exact gate explicitly. Releases and approvals are never
 * advanced automatically.
 */
export function nextPhase(state, pauseAfter = DEFAULT_PAUSE_AFTER) {
  if (!state) return { action: 'none', reason: 'No AutopAI state found for this repository.' }

  const mode = String(state.mode ?? '')
  const phase = String(state.phase ?? '')

  if (phase === 'aborted') {
    return RESUMABLE.has(mode)
      ? { action: 'resume', mode }
      : { action: 'none', reason: `The last ${mode || 'unknown'} run was aborted. Re-run its command explicitly.` }
  }

  const gate = currentGate(state)
  if (gate) {
    if (pauseAfter.includes(gate)) {
      return {
        action: 'none',
        reason: `Paused at the ${gateLabel(gate)} gate. Review the artifacts, then run autopai resume --approve ${gate}.`
      }
    }
    const next = phaseAfterGate(gate)
    if (next) return { action: next, feature: state.feature ?? null }
    return { action: 'none', reason: 'Refactoring is complete. Start a new feature or run /autopai-release.' }
  }

  if (mode === 'adopt' && phase === 'merged') {
    return { action: 'none', reason: 'The adopted branch is merged. Start the next phase explicitly.' }
  }
  if (mode === 'release' && phase === 'released') {
    return { action: 'none', reason: 'The release is complete.' }
  }
  if (mode === 'release' || mode === 'approve') {
    return { action: 'none', reason: `The ${mode} mode is not resumed automatically. Re-run its original command.` }
  }
  if (RESUMABLE.has(mode)) return { action: 'resume', mode }
  return { action: 'none', reason: `Cannot continue mode ${mode || '(none)'} automatically.` }
}

/**
 * Selects the audit scopes that still need an auditor session, skipping the
 * ones recorded as completed in the state.
 */
export function pendingScopes(scopes, completedPhases = []) {
  const done = new Set(
    (completedPhases ?? [])
      .filter(phase => String(phase).startsWith('identify:'))
      .map(phase => String(phase).slice('identify:'.length))
  )
  return (scopes ?? []).filter(scope => !done.has(String(scope.name)))
}
