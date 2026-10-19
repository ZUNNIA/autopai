import fs from 'node:fs/promises'
import path from 'node:path'
import { runCommand } from '../lib/runner.js'
import { ensureDir } from '../lib/util.js'

/**
 * Writes the rendered prompt next to the session log and returns its path.
 * The prompt never travels in the command line: Windows runs npm shims through
 * cmd.exe, whose command-line limit overflows with large payloads.
 */
export async function writePromptFile(logFile, promptText) {
  const file = `${String(logFile).replace(/\.log$/, '')}.prompt.md`
  await ensureDir(path.dirname(file))
  await fs.writeFile(file, promptText, 'utf8')
  return file
}

/**
 * Builds the OpenCode CLI arguments for one non-interactive session. The agent
 * selects the permissions; the prompt text is owned by the core and is attached
 * as a file so the command line stays small.
 */
export function buildArgs({ config, agent, promptFile, title, role }) {
  const args = ['run', '--auto', '--dir', config.repoPath, '--title', title]
  if (agent) args.push('--agent', agent)
  const model = role ? config.models?.[role] : null
  if (model) args.push('--model', model)
  args.push('--file', promptFile)
  args.push(`Read the attached AutopAI instruction document at ${promptFile} and follow it exactly.`)
  return args
}

export async function runSession({ config, agent, promptText, title, logFile, role }) {
  const promptFile = await writePromptFile(logFile, promptText)
  const args = buildArgs({ config, agent, promptFile, title, role })
  return runCommand('opencode', args, {
    cwd: config.repoPath,
    env: { ...(config.runnerOptions?.env ?? {}), OPENCODE_DISABLE_AUTOUPDATE: '1' },
    timeoutMs: config.sessionTimeoutMinutes * 60000,
    logFile
  })
}
