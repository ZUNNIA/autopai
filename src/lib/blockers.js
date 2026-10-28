import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureDir, walkFiles } from './util.js'

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

/**
 * Moves the blockers recorded by a previous failed attempt out of the active
 * input directory before an explicit dev or refactor retry. A new blocker from
 * the retry remains active and still stops the run.
 */
export async function archiveBlockers({ blockers, artifactsDir }) {
  const archived = []
  if (!Array.isArray(blockers) || blockers.length === 0) return archived

  const targetDir = path.join(artifactsDir, 'resolved-blockers')
  await ensureDir(targetDir)
  for (const [index, blocker] of blockers.entries()) {
    const file = typeof blocker === 'string' ? blocker : blocker?.file
    if (!file) continue
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    const target = path.join(targetDir, `${stamp}-${index}-${path.basename(file)}`)
    try {
      await fs.rename(file, target)
      archived.push({ from: file, to: target })
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Could not archive blocker ${file}: ${error.message}`)
    }
  }
  return archived
}

export function blockerMessage(blockers) {
  const lines = blockers.map(blocker => {
    const reason = String(blocker.reason ?? blocker.decision ?? '').trim()
    const action = String(blocker.suggestedAction ?? '').trim()
    return `${blocker.file}${reason ? `: ${reason}` : ''}${action ? ` (${action})` : ''}`
  })
  return `The executor is blocked:\n${lines.join('\n')}\nResolve the blocker and run autopai resume. Architecture decisions: run /autopai-adr in your coding tool first.`
}
