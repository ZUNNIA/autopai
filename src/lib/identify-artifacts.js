import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureDir, walkFiles } from './util.js'

/**
 * Moves the findings of previous identify runs out of the active scope
 * directories before a fresh audit. The current run therefore validates and
 * promotes only the files it writes, while the previous findings remain under
 * the run artifacts for inspection.
 */
export async function archiveIdentifiedArtifacts({ config, artifacts, scopes, log }) {
  const root = artifacts.path('identified-archive')
  const archived = []

  for (const scope of scopes) {
    const source = path.join(config.repoPath, config.ticketDirs.identified, scope.name)
    const files = await walkFiles(source, file => file.endsWith('.md'))
    if (files.length === 0) continue

    const target = path.join(root, scope.name)
    await ensureDir(target)
    for (const file of files) {
      const destination = path.join(target, path.basename(file))
      await moveFile(file, destination)
      archived.push({ scope: scope.name, file, destination })
    }
    await log?.(`Archived ${files.length} previous findings for ${scope.name} at ${target}.`)
  }

  return { root: archived.length > 0 ? root : null, archived }
}

async function moveFile(source, destination) {
  try {
    await fs.rename(source, destination)
  } catch (error) {
    if (error.code !== 'EXDEV') throw error
    await fs.copyFile(source, destination)
    await fs.unlink(source)
  }
}
