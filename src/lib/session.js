import { loadPrompt } from './prompts.js'
import { resolveRunner } from '../runners/index.js'

/**
 * Runs one non-interactive coding-tool session with a core-owned prompt. The
 * runner maps the call to the configured CLI, so the core stays independent
 * from any specific client.
 */
export async function runSession({ config, prompt, agent, payload, title, logFile, role }) {
  const promptText = await loadPrompt(prompt, payload)
  const runner = await resolveRunner(config)
  return runner.runSession({ config, agent, promptText, title, logFile, role })
}
