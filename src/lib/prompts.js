import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROMPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prompts')
const NAME_PATTERN = /^[a-z0-9-]+$/

/**
 * Loads a core-owned prompt and substitutes the JSON payload. Core-owned
 * prompts keep the orchestrator independent from any coding tool.
 */
export async function loadPrompt(name, payload) {
  if (!NAME_PATTERN.test(String(name))) throw new Error(`Invalid prompt name: ${name}`)
  const file = path.join(PROMPTS_DIR, `${name}.md`)
  const template = await fs.readFile(file, 'utf8')
  return renderPrompt(template, payload)
}

export function renderPrompt(template, payload) {
  if (payload === undefined || payload === null) {
    return String(template).replaceAll('{{PAYLOAD}}', '')
  }
  const block = ['```json', JSON.stringify(payload, null, 2), '```'].join('\n')
  return String(template).replaceAll('{{PAYLOAD}}', block)
}

export function promptsDirectory() {
  return PROMPTS_DIR
}
