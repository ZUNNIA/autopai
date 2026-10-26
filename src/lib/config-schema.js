import { DEFAULT_PAUSE_AFTER } from './pauses.js'

export const DEFAULT_TICKET_DIRS = {
  backlog: 'tickets/backlog',
  readyForDev: 'tickets/ready-for-dev',
  identified: 'tickets/identified',
  readyForRefactor: 'tickets/ready-for-refactor',
  ux: 'tickets/ux',
  qa: 'tickets/qa',
  done: 'tickets/done'
}

export const DEFAULT_PROTECTED_PATHS = [
  '.github/**',
  'AGENTS.md',
  'autopai.json'
]

export const DEFAULT_COMMIT_TYPES = [
  'feat',
  'fix',
  'refactor',
  'perf',
  'test',
  'docs',
  'chore'
]

export const DEFAULT_AGENTS = {
  executor: 'executor',
  planner: 'planner',
  auditor: 'auditor',
  operator: 'autopai'
}

export const DEFAULT_MODELS = {
  executor: null,
  planner: null,
  auditor: null,
  operator: null
}

export const DEFAULTS = {
  runnerOptions: {},
  protectedPaths: DEFAULT_PROTECTED_PATHS,
  baseBranch: 'main',
  releaseBranch: 'main',
  requiredChecks: [],
  ignoredChecks: [],
  restoreCommand: null,
  buildCommand: null,
  testCommand: null,
  smokeCommand: null,
  coverageThreshold: null,
  auditChunkFiles: 40,
  localGateRetries: 1,
  continueOnFailure: true,
  maxAttempts: 3,
  maxMinutes: 240,
  commandTimeoutMinutes: 30,
  sessionTimeoutMinutes: 90,
  checkPollSeconds: 30,
  checkTimeoutMinutes: 30,
  autoMerge: true,
  approvalRequired: true,
  pauseAfter: [...DEFAULT_PAUSE_AFTER],
  prTitle: null,
  runtimeLogs: [],
  commitTypes: DEFAULT_COMMIT_TYPES,
  agents: DEFAULT_AGENTS,
  models: DEFAULT_MODELS
}

export const DEPRECATED_FIELDS = {
  autoMerge: 'Reserved. Merges always happen after the required checks pass.',
  approvalRequired: 'Superseded by pauseAfter.'
}

export const TICKET_DIR_KEYS = Object.keys(DEFAULT_TICKET_DIRS)
export const AGENT_KEYS = Object.keys(DEFAULT_AGENTS)
export const MODEL_KEYS = Object.keys(DEFAULT_MODELS)

export const TOP_LEVEL_KEYS = new Set([
  'runner',
  'ticketDirs',
  'stateDir',
  ...Object.keys(DEFAULTS)
])

export const REQUIRED_KEYS = new Set(['runner'])
