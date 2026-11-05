import { runCommand } from '../lib/runner.js'
import { writePromptFile, uniqueSessionTitle, pickSessionToDelete, normalizeDirectory } from './common.js'

export { writePromptFile, uniqueSessionTitle, pickSessionToDelete } from './common.js'

/**
 * Builds the OpenCode CLI arguments for one non-interactive session. The agent
 * selects the permissions; the prompt text is owned by the core and is piped
 * through stdin, which keeps every payload size off the command line.
 */
export function buildArgs({ config, agent, title, role }) {
  const args = ['run', '--auto', '--dir', config.repoPath, '--title', title]
  if (agent) args.push('--agent', agent)
  const model = role ? config.models?.[role] : null
  if (model) args.push('--model', model)
  return args
}

/**
 * Builds the arguments for a follow-up message in an existing session. The
 * message travels through stdin and no title, prompt file, or session cleanup is
 * involved; the planner's original context remains authoritative.
 */
export function buildContinueArgs({ config, sessionId, agent }) {
  const args = ['run', '--auto', '--dir', config.repoPath, '--session', sessionId]
  if (agent) args.push('--agent', agent)
  return args
}

async function listRunSessions(config) {
  const listed = await runCommand('opencode', ['session', 'list', '--max-count', '25', '--format', 'json'], {
    cwd: config.repoPath,
    timeoutMs: 60000
  })
  if (listed.code !== 0) return null
  try {
    return JSON.parse(listed.stdout)
  } catch {
    return null
  }
}

async function findRunSession({ config, title, startedAt }) {
  const sessions = await listRunSessions(config)
  return pickSessionToDelete(sessions, { title, directory: config.repoPath, since: startedAt })
}

async function deleteRunSession({ config, title, startedAt }) {
  if (config.runnerOptions?.keepSessions === true) return

  const session = await findRunSession({ config, title, startedAt })
  if (!session) return
  await runCommand('opencode', ['session', 'delete', session.id], { cwd: config.repoPath, timeoutMs: 60000 })
}

/**
 * Lists the coding-tool sessions for review recovery. The core only uses the
 * normalized title, id, directory and creation time; it never assumes the
 * tool-specific fields beyond what the runner exposes.
 */
export async function listSessions({ config }) {
  return (await listRunSessions(config)) ?? []
}

/**
 * Deletes one retained session by id, or by its unique title when the id was
 * not available when the session was stored. `keepSessions` remains an
 * explicit opt-out from every cleanup.
 */
export async function deleteSession({ config, session }) {
  if (config.runnerOptions?.keepSessions === true) {
    return { deleted: false, reason: 'keepSessions is enabled' }
  }

  let id = session?.id ?? null
  if (!id && session?.title) {
    const found = pickSessionToDelete(await listRunSessions(config), {
      title: session.title,
      directory: config.repoPath,
      since: 0
    })
    id = found?.id ?? null
  }
  if (!id) return { deleted: false, reason: 'session not found' }

  const result = await runCommand('opencode', ['session', 'delete', id], { cwd: config.repoPath, timeoutMs: 60000 })
  return {
    deleted: result.code === 0,
    reason: result.code === 0 ? null : (result.stderr || result.stdout || 'session deletion failed')
  }
}

export async function continueSession({ config, session, message, agent, logFile }) {
  let sessionId = session?.id ?? null
  if (!sessionId && session?.title) {
    const found = pickSessionToDelete(await listRunSessions(config), {
      title: session.title,
      directory: config.repoPath,
      since: 0
    })
    sessionId = found?.id ?? null
  }
  if (!sessionId) throw new Error('The retained planner session was not found.')

  const result = await runCommand('opencode', buildContinueArgs({ config, sessionId, agent }), {
    cwd: config.repoPath,
    env: { ...(config.runnerOptions?.env ?? {}), OPENCODE_DISABLE_AUTOUPDATE: '1' },
    timeoutMs: config.sessionTimeoutMinutes * 60000,
    logFile,
    stdin: message
  })
  return { ...result, sessionId }
}

export async function runSession({ config, agent, promptText, title, logFile, role, retainSession = false }) {
  await writePromptFile(logFile, promptText)
  const sessionTitle = uniqueSessionTitle(title)
  const args = buildArgs({ config, agent, title: sessionTitle, role })
  const startedAt = Date.now()
  const result = await runCommand('opencode', args, {
    cwd: config.repoPath,
    env: { ...(config.runnerOptions?.env ?? {}), OPENCODE_DISABLE_AUTOUPDATE: '1' },
    timeoutMs: config.sessionTimeoutMinutes * 60000,
    logFile,
    stdin: promptText
  })

  if (retainSession) {
    const found = await findRunSession({ config, title: sessionTitle, startedAt })
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

  await deleteRunSession({ config, title: sessionTitle, startedAt })
  return result
}
