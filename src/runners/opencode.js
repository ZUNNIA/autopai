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

export async function runSession({ config, agent, promptText, title, logFile, role }) {
  await writePromptFile(logFile, promptText)
  const args = buildArgs({ config, agent, title, role })
  return runCommand('opencode', args, {
    cwd: config.repoPath,
    env: { ...(config.runnerOptions?.env ?? {}), OPENCODE_DISABLE_AUTOUPDATE: '1' },
    timeoutMs: config.sessionTimeoutMinutes * 60000,
    logFile,
    stdin: promptText
  })
}
