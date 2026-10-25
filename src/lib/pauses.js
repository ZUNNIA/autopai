/**
 * Human gates stop the assisted loop after a phase completes. A gate is not an
 * approval: running the continuation command again leaves the run at the gate
 * unless the user explicitly approves that gate. The gate names are the stable
 * vocabulary for `pauseAfter`, `--approve`, and the pause messages.
 */
export const GATES = ['backlog', 'plan', 'qa', 'findings', 'promotion', 'refactor']

export const DEFAULT_PAUSE_AFTER = ['backlog', 'plan', 'qa']

const GATE_LABELS = {
  backlog: 'backlog',
  plan: 'ready-for-dev plan',
  qa: 'manual QA',
  findings: 'audit findings',
  promotion: 'ready-for-refactor tickets',
  refactor: 'refactor'
}

const STATE_GATES = {
  'prepare/awaiting_approval': 'backlog',
  'approve/approved': 'plan',
  'dev/dev-complete': 'qa',
  'identify/identified': 'findings',
  'promote/promoted': 'promotion',
  'refactor/refactor-complete': 'refactor'
}

const PHASE_GATES = {
  prepare: 'backlog',
  approve: 'plan',
  dev: 'qa',
  identify: 'findings',
  promote: 'promotion',
  refactor: 'refactor'
}

const GATE_PHASES = {
  backlog: 'approve',
  plan: 'dev',
  qa: 'identify',
  findings: 'promote',
  promotion: 'refactor'
}

/**
 * Normalizes a pause list from the config or the command line. Missing values
 * keep the default; an empty list disables every human pause. Unknown gates fail
 * fast so a typo cannot silently remove a checkpoint.
 */
export function normalizePauseAfter(value, fallback = DEFAULT_PAUSE_AFTER) {
  const source = value == null ? fallback : value
  const list = Array.isArray(source) ? source : String(source).split(',')
  const gates = []
  for (const item of list) {
    const gate = String(item).trim()
    if (!gate) continue
    if (!GATES.includes(gate)) throw new Error(`Invalid pause gate: ${gate}. Use one of: ${GATES.join(', ')}.`)
    if (!gates.includes(gate)) gates.push(gate)
  }
  return gates
}

/**
 * Validates the single gate named by `--approve`. Approving several gates at
 * once would defeat the review the gate exists for.
 */
export function normalizeApprovedGate(value) {
  const gates = normalizePauseAfter(value, [])
  if (gates.length !== 1) throw new Error(`--approve requires exactly one gate: ${GATES.join(', ')}.`)
  return gates[0]
}

export function currentGate(state) {
  if (!state) return null
  return STATE_GATES[`${state.mode}/${state.phase}`] ?? null
}

export function gateAfterPhase(phase) {
  return PHASE_GATES[phase] ?? null
}

export function phaseAfterGate(gate) {
  return GATE_PHASES[gate] ?? null
}

export function gateLabel(gate) {
  return GATE_LABELS[gate] ?? gate
}
