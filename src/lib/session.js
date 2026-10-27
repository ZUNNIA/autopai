import { loadPrompt } from './prompts.js'
import { resolveRunner } from '../runners/index.js'

/**
 * Runs one non-interactive coding-tool session with a core-owned prompt. The
 * runner maps the call to the configured CLI, so the core stays independent
 * from any specific client.
 */
export async function runSession({ config, prompt, agent, payload, title, logFile, role, retainSession = false }) {
  const promptText = await loadPrompt(prompt, payload)
  const runner = await resolveRunner(config)
  return runner.runSession({ config, agent, promptText, title, logFile, role, retainSession })
}

/**
 * Lists retained sessions through the configured runner. Recovery must never
 * start a new session or reload a core prompt; it only reconnects state with
 * conversations that already exist.
 */
export async function listSessions(config) {
  const runner = await resolveRunner(config)
  if (typeof runner.listSessions !== 'function') return []
  return runner.listSessions({ config })
}

/**
 * Deletes one retained session through the configured runner. A runner without
 * session management leaves the conversation in place; deletion is best effort.
 */
export async function deleteSession({ config, session }) {
  const runner = await resolveRunner(config)
  if (typeof runner.deleteSession !== 'function') {
    return { deleted: false, reason: 'runner does not support session deletion' }
  }
  return runner.deleteSession({ config, session })
}
