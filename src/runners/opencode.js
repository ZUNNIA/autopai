import fs from 'node:fs/promises'
import path from 'node:path'
import { runCommand } from '../lib/runner.js'
import { ensureDir } from '../lib/util.js'

/**
 * Writes a copy of the rendered prompt next to the session log for debugging.
 * The prompt itself travels through stdin, because opencode reads it natively:
 * neither the command line (OS limits, cmd.exe parsing) nor the attachment
 * parser (array options consume trailing positionals) can mangle it.
 */
export async function writePromptFile(logFile, promptText) {
  const file = `${String(logFile).replace(/\.log$/, '')}.prompt.md`
  await ensureDir(path.dirname(file))
  await fs.writeFile(file, promptText, 'utf8')
  return file
}

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
 * Picks the session created by one run for cleanup: same title, same project
 * directory, and created at or after the run started. Older sessions that
 * reuse a title are never touched.
 */
export function pickSessionToDelete(sessions, { title, directory, since }) {
  const target = normalizeDirectory(directory)
  return (sessions ?? [])
    .filter(session => session
      && session.title === title
      && normalizeDirectory(session.directory) === target
      && Number(session.created ?? session.updated ?? 0) >= since)
    .sort((left, right) => Number(right.updated ?? 0) - Number(left.updated ?? 0))[0] ?? null
}

async function deleteRunSession({ config, title, startedAt }) {
  if (config.runnerOptions?.keepSessions === true) return

  const listed = await runCommand('opencode', ['session', 'list', '--max-count', '25', '--format', 'json'], {
    cwd: config.repoPath,
    timeoutMs: 60000
  })
  if (listed.code !== 0) return

  let sessions
  try {
    sessions = JSON.parse(listed.stdout)
  } catch {
    return
  }

  const session = pickSessionToDelete(sessions, { title, directory: config.repoPath, since: startedAt })
  if (!session) return
  await runCommand('opencode', ['session', 'delete', session.id], { cwd: config.repoPath, timeoutMs: 60000 })
}

function normalizeDirectory(directory) {
  const normalized = String(directory ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

export async function runSession({ config, agent, promptText, title, logFile, role }) {
  await writePromptFile(logFile, promptText)
  const args = buildArgs({ config, agent, title, role })
  const startedAt = Date.now()
  const result = await runCommand('opencode', args, {
    cwd: config.repoPath,
    env: { ...(config.runnerOptions?.env ?? {}), OPENCODE_DISABLE_AUTOUPDATE: '1' },
    timeoutMs: config.sessionTimeoutMinutes * 60000,
    logFile,
    stdin: promptText
  })
  await deleteRunSession({ config, title, startedAt })
  return result
}
