import fs from 'node:fs/promises'
import path from 'node:path'
import { walkFiles } from './util.js'

/**
 * Reads the executor blockers written under the state directory. The executor
 * writes one JSON file per blocked work item when it needs a human decision;
 * malformed files are still listed so the raw path is never lost.
 */
export async function listBlockers(config) {
  const files = await walkFiles(path.join(config.stateDir, 'needs-human'), file => file.endsWith('.json'))
  const blockers = []
  for (const file of files) {
    let payload = {}
    try {
      payload = JSON.parse(await fs.readFile(file, 'utf8'))
    } catch {
      // Keep the path so the human can inspect the raw file.
    }
    blockers.push({ ...payload, file })
  }
  return blockers
}

export function blockerMessage(blockers) {
  const lines = blockers.map(blocker => {
    const reason = String(blocker.reason ?? blocker.decision ?? '').trim()
    const action = String(blocker.suggestedAction ?? '').trim()
    return `${blocker.file}${reason ? `: ${reason}` : ''}${action ? ` (${action})` : ''}`
  })
  return `The executor is blocked:\n${lines.join('\n')}\nResolve the blocker and run autopai resume. Architecture decisions: run /autopai-adr in your coding tool first.`
}
