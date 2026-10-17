import { runCommand } from './runner.js'

/**
 * Runs a custom OpenCode command in a fresh non-interactive session. The
 * command file selects the agent and permissions; this helper only supplies the
 * repository, title, and a single JSON payload as the message.
 */
export async function runOpenCode({ config, command, payload, title, logFile, role }) {
  const args = [
    'run',
    '--command',
    command,
    '--auto',
    '--dir',
    config.repoPath,
    '--title',
    title
  ]
  const model = role ? config.models?.[role] : null
  if (model) args.push('--model', model)
  if (payload !== undefined) args.push(JSON.stringify(payload))
  return runCommand('opencode', args, {
    cwd: config.repoPath,
    env: { OPENCODE_DISABLE_AUTOUPDATE: '1' },
    timeoutMs: config.sessionTimeoutMinutes * 60000,
    logFile
  })
}
