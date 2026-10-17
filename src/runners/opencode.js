import { runCommand } from '../lib/runner.js'

/**
 * Builds the OpenCode CLI arguments for one non-interactive session. The
 * agent selects the permissions; the prompt text is owned by the core.
 */
export function buildArgs({ config, agent, promptText, title, role }) {
  const args = ['run', '--auto', '--dir', config.repoPath, '--title', title]
  if (agent) args.push('--agent', agent)
  const model = role ? config.models?.[role] : null
  if (model) args.push('--model', model)
  args.push(promptText)
  return args
}

export async function runSession({ config, agent, promptText, title, logFile, role }) {
  const args = buildArgs({ config, agent, promptText, title, role })
  return runCommand('opencode', args, {
    cwd: config.repoPath,
    env: { ...(config.runnerOptions?.env ?? {}), OPENCODE_DISABLE_AUTOUPDATE: '1' },
    timeoutMs: config.sessionTimeoutMinutes * 60000,
    logFile
  })
}
