import { runCommand } from '../lib/runner.js'
import { writePromptFile, uniqueSessionTitle, pickSessionToDelete, normalizeSession } from './common.js'

const PROMPT_MODES = new Set(['stdin', 'file', 'argument'])
const COMMAND_KEYS = new Set(['run', 'prompt', 'continue', 'list', 'delete', 'env', 'keepSessions'])
const PLACEHOLDERS = new Set(['agent', 'model', 'title', 'repo', 'role', 'promptFile', 'prompt', 'sessionId'])
const PLACEHOLDER_RE = /\{([a-z][A-Za-z0-9]*)\}/g

export function commandOptions(config) {
  return config.runnerOptions ?? {}
}

export function validateCommandRunnerOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('runnerOptions must be an object for the command runner.')
  }
  for (const key of Object.keys(options)) {
    if (!COMMAND_KEYS.has(key)) throw new Error(`Unknown command runner option: ${key}.`)
  }
  validateCommand(options.run, 'runnerOptions.run', true)
  for (const key of ['continue', 'list', 'delete']) {
    if (options[key] !== undefined) validateCommand(options[key], `runnerOptions.${key}`, false)
  }
  if (options.prompt !== undefined && !PROMPT_MODES.has(options.prompt)) {
    throw new Error(`runnerOptions.prompt must be one of: ${[...PROMPT_MODES].join(', ')}.`)
  }
  if (options.env !== undefined && (!options.env || typeof options.env !== 'object' || Array.isArray(options.env))) {
    throw new Error('runnerOptions.env must be an object.')
  }
  if (options.keepSessions !== undefined && typeof options.keepSessions !== 'boolean') {
    throw new Error('runnerOptions.keepSessions must be a boolean.')
  }
  const mode = options.prompt ?? 'stdin'
  assertPromptTransport(options.run, mode, 'runnerOptions.run')
  if (options.continue !== undefined) assertPromptTransport(options.continue, mode, 'runnerOptions.continue')
}

function validateCommand(command, name, required) {
  if (command === undefined && !required) return
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error(`${name} must be a non-empty array of strings.`)
  }
  if (!command.every(item => typeof item === 'string')) {
    throw new Error(`${name} must contain only strings.`)
  }
  for (const item of command) {
    for (const match of item.matchAll(PLACEHOLDER_RE)) {
      if (!PLACEHOLDERS.has(match[1])) throw new Error(`${name} contains an unknown placeholder: {${match[1]}}.`)
    }
  }
}

export function promptMode(options) {
  return options.prompt ?? 'stdin'
}

export function expandCommand(command, values) {
  const args = []
  for (const item of command) {
    const exact = item.match(/^\{([a-z][A-Za-z0-9]*)\}$/)
    if (exact) {
      const value = values[exact[1]]
      if (value == null || value === '') {
        if (args.length > 0 && args[args.length - 1].startsWith('-')) args.pop()
        continue
      }
      args.push(String(value))
      continue
    }
    args.push(item.replace(PLACEHOLDER_RE, (_, key) => String(values[key] ?? '')))
  }
  return args
}

function promptValues({ config, agent, title, role, promptFile, promptText, sessionId }) {
  return {
    agent: agent ?? '',
    model: role ? config.models?.[role] ?? '' : '',
    title: title ?? '',
    repo: config.repoPath,
    role: role ?? '',
    promptFile: promptFile ?? '',
    prompt: promptText ?? '',
    sessionId: sessionId ?? ''
  }
}

function assertPromptTransport(command, mode, name) {
  const joined = command.join(' ')
  if (mode === 'file' && !joined.includes('{promptFile}')) {
    throw new Error(`${name} must include {promptFile} when runnerOptions.prompt is "file".`)
  }
  if (mode === 'argument' && !joined.includes('{prompt}')) {
    throw new Error(`${name} must include {prompt} when runnerOptions.prompt is "argument".`)
  }
}

async function runConfiguredCommand(config, command, values, options = {}) {
  const mode = promptMode(commandOptions(config))
  const args = expandCommand(command, values)
  const stdin = mode === 'stdin' ? options.promptText : undefined
  return runCommand(args[0], args.slice(1), {
    cwd: config.repoPath,
    env: { ...(commandOptions(config).env ?? {}), ...(options.env ?? {}) },
    timeoutMs: config.sessionTimeoutMinutes * 60000,
    logFile: options.logFile,
    stdin
  })
}

function parseSessions(text) {
  let data
  try {
    data = JSON.parse(String(text ?? '').trim())
  } catch {
    return []
  }
  const list = Array.isArray(data) ? data : data?.sessions
  if (!Array.isArray(list)) return []
  return list.map(normalizeSession).filter(Boolean)
}

async function listConfiguredSessions(config, options = commandOptions(config)) {
  if (!options.list) return []
  const args = expandCommand(options.list, promptValues({ config }))
  const result = await runCommand(args[0], args.slice(1), {
    cwd: config.repoPath,
    env: { ...(options.env ?? {}) },
    timeoutMs: 60000
  })
  if (result.code !== 0) return []
  return parseSessions(result.stdout)
}

async function findConfiguredSession({ config, title, startedAt }) {
  const sessions = await listConfiguredSessions(config)
  return pickSessionToDelete(sessions, { title, directory: config.repoPath, since: startedAt })
}

async function deleteConfiguredSession({ config, title, startedAt }) {
  const options = commandOptions(config)
  if (options.keepSessions === true || !options.delete) return
  const session = await findConfiguredSession({ config, title, startedAt })
  if (!session?.id) return
  const args = expandCommand(options.delete, { sessionId: session.id, repo: config.repoPath })
  await runCommand(args[0], args.slice(1), {
    cwd: config.repoPath,
    env: { ...(options.env ?? {}) },
    timeoutMs: 60000
  })
}

export async function listSessions({ config }) {
  return listConfiguredSessions(config)
}

export async function deleteSession({ config, session }) {
  const options = commandOptions(config)
  if (options.keepSessions === true) return { deleted: false, reason: 'keepSessions is enabled' }
  if (!options.delete) return { deleted: false, reason: 'runner does not support session deletion' }
  let id = session?.id ?? null
  if (!id && session?.title) {
    const found = await findConfiguredSession({ config, title: session.title, startedAt: 0 })
    id = found?.id ?? null
  }
  if (!id) return { deleted: false, reason: 'session not found' }
  const args = expandCommand(options.delete, { sessionId: id, repo: config.repoPath })
  const result = await runCommand(args[0], args.slice(1), {
    cwd: config.repoPath,
    env: { ...(options.env ?? {}) },
    timeoutMs: 60000
  })
  return {
    deleted: result.code === 0,
    reason: result.code === 0 ? null : (result.stderr || result.stdout || 'session deletion failed')
  }
}

export async function continueSession({ config, session, message, agent, logFile }) {
  const options = commandOptions(config)
  if (!options.continue) throw new Error('The configured command runner cannot continue an existing session.')
  let sessionId = session?.id ?? null
  if (!sessionId && session?.title) {
    const found = await findConfiguredSession({ config, title: session.title, startedAt: 0 })
    sessionId = found?.id ?? null
  }
  if (!sessionId) throw new Error('The retained planner session was not found.')

  const promptFile = await writePromptFile(logFile, message)
  const mode = promptMode(options)
  assertPromptTransport(options.continue, mode, 'runnerOptions.continue')
  const values = promptValues({ config, agent, promptFile, promptText: message, sessionId })
  const result = await runConfiguredCommand(config, options.continue, values, {
    promptText: message,
    logFile
  })
  return { ...result, sessionId }
}

export async function runSession({ config, agent, promptText, title, logFile, role, retainSession = false }) {
  const options = commandOptions(config)
  validateCommandRunnerOptions(options)
  const promptFile = await writePromptFile(logFile, promptText)
  const sessionTitle = uniqueSessionTitle(title)
  const mode = promptMode(options)
  assertPromptTransport(options.run, mode, 'runnerOptions.run')
  const values = promptValues({ config, agent, title: sessionTitle, role, promptFile, promptText })
  const startedAt = Date.now()
  const result = await runConfiguredCommand(config, options.run, values, { promptText, logFile })

  if (retainSession) {
    const found = await findConfiguredSession({ config, title: sessionTitle, startedAt })
    return {
      ...result,
      session: {
        id: found?.id ?? null,
        title: sessionTitle,
        directory: config.repoPath,
        created: found?.created ?? null
      }
    }
  }

  await deleteConfiguredSession({ config, title: sessionTitle, startedAt })
  return result
}
