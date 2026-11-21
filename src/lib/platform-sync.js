import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { atomicWriteJson, ensureDir, exists, readJson, walkFiles } from './util.js'

const MANAGED_DIRECTORIES = ['commands', 'agents']
const STATE_DIRECTORY = '.autopai'
const KEEP_BACKUPS = 10
const AGENTS_BEGIN = '<!-- autopai:begin -->'
const AGENTS_END = '<!-- autopai:end -->'

export function defaultPlatformTarget() {
  return process.env.AUTOPAI_OPENCODE_DIR
    ? path.resolve(process.env.AUTOPAI_OPENCODE_DIR)
    : path.join(os.homedir(), '.config', 'opencode')
}

export function platformSourceRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'platforms', 'opencode')
}

/**
 * Synchronizes the OpenCode commands, agents, and global AGENTS.md block owned
 * by AutopAI. Files outside that set are never touched, and every overwrite or
 * removal is copied to a timestamped backup first.
 */
export async function syncPlatform(input = {}) {
  const target = path.resolve(input.target ?? defaultPlatformTarget())
  const source = path.resolve(input.source ?? platformSourceRoot())
  if (target === source) throw new Error('The platform target must differ from the source directory.')
  const agentsSource = path.resolve(input.agentsSource ?? path.join(source, '..', '..', 'AGENTS.md'))
  const dryRun = input.dryRun === true
  const warnings = []
  const created = []
  const updated = []
  const removed = []
  const backedUp = []
  const unchanged = []
  const stateDir = path.join(target, STATE_DIRECTORY)
  const manifestPath = path.join(stateDir, 'manifest.json')
  const manifest = await readManifest(manifestPath, warnings)
  const backupRoot = path.join(stateDir, 'backups', backupStamp())
  const files = {}

  if (!await exists(source)) throw new Error(`AutopAI platform source not found: ${source}`)

  for (const directory of MANAGED_DIRECTORIES) {
    const managed = await walkFiles(path.join(source, directory), file => file.endsWith('.md'))
    for (const file of managed) {
      const id = toPortableRelative(source, file)
      const content = await fs.readFile(file, 'utf8')
      files[id] = sha256(content)
      const destination = path.join(target, ...id.split('/'))
      if (!await exists(destination)) {
        created.push(destination)
        if (!dryRun) await writeTextAtomic(destination, content)
        continue
      }
      if (await fs.readFile(destination, 'utf8') === content) {
        unchanged.push(destination)
        continue
      }
      updated.push(destination)
      if (!dryRun) {
        await backupFile(destination, target, backupRoot, backedUp)
        await writeTextAtomic(destination, content)
      }
    }
  }

  if (manifest) {
    for (const id of Object.keys(manifest.files ?? {})) {
      if (files[id] || !isManagedId(id)) continue
      const destination = path.join(target, ...id.split('/'))
      if (!await exists(destination)) continue
      removed.push(destination)
      if (!dryRun) {
        await backupFile(destination, target, backupRoot, backedUp)
        await fs.rm(destination, { force: true })
      }
    }
  }

  const agents = await syncAgentsFile({
    target,
    source: agentsSource,
    backupRoot,
    backedUp,
    warnings,
    dryRun
  })

  if (!dryRun) {
    const next = {
      schemaVersion: 1,
      toolVersion: await toolVersion(),
      sourceCommit: process.env.AUTOPAI_SOURCE_COMMIT ?? null,
      updatedAt: new Date().toISOString(),
      files,
      agentsHash: agents.hash
    }
    await atomicWriteJson(manifestPath, next)
    await pruneBackups(path.join(stateDir, 'backups'))
  }

  return {
    target,
    source,
    dryRun,
    created,
    updated,
    removed,
    backedUp,
    unchanged,
    agents,
    warnings,
    manifestPath
  }
}

async function syncAgentsFile(input) {
  const file = path.join(input.target, 'AGENTS.md')
  if (path.resolve(file) === path.resolve(input.source)) {
    input.warnings.push(`Skipped ${file} because it is the source file.`)
    return { action: 'skipped', file, hash: null }
  }
  if (!await exists(input.source)) {
    input.warnings.push(`AutopAI AGENTS.md source not found: ${input.source}`)
    return { action: 'skipped', file, hash: null }
  }
  const rules = (await fs.readFile(input.source, 'utf8')).trim()
  const block = `${AGENTS_BEGIN}\n${rules}\n${AGENTS_END}`
  if (!await exists(file)) {
    if (!input.dryRun) await writeTextAtomic(file, `${block}\n`)
    return { action: 'created', file, hash: sha256(block) }
  }

  const current = await fs.readFile(file, 'utf8')
  const begin = current.indexOf(AGENTS_BEGIN)
  const end = current.indexOf(AGENTS_END)
  let next
  let action
  if (begin >= 0 && end > begin) {
    next = `${current.slice(0, begin)}${block}${current.slice(end + AGENTS_END.length)}`
    action = 'updated'
  } else if (similarity(current, rules) >= 0.8) {
    next = `${block}\n`
    action = 'migrated'
  } else {
    const separator = current.endsWith('\n') ? '\n' : '\n\n'
    next = `${current}${separator}${block}\n`
    action = 'appended'
  }

  if (next === current) return { action: 'unchanged', file, hash: sha256(block) }
  if (!input.dryRun) {
    await backupFile(file, input.target, input.backupRoot, input.backedUp)
    await writeTextAtomic(file, next)
  }
  return { action, file, hash: sha256(block) }
}

async function readManifest(file, warnings) {
  if (!await exists(file)) return null
  try {
    const manifest = await readJson(file)
    if (!manifest || typeof manifest !== 'object' || typeof manifest.files !== 'object' || manifest.files === null) {
      throw new Error('the manifest has no files map')
    }
    return manifest
  } catch (error) {
    warnings.push(`Ignored ${file}: ${error.message}`)
    return null
  }
}

async function backupFile(file, target, backupRoot, backedUp) {
  if (!await exists(file)) return
  const relative = toPortableRelative(target, file)
  const destination = path.join(backupRoot, ...relative.split('/'))
  await ensureDir(path.dirname(destination))
  await fs.copyFile(file, destination)
  backedUp.push(destination)
}

async function pruneBackups(root) {
  let entries
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return
  }
  const names = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  const stale = names.slice(0, Math.max(0, names.length - KEEP_BACKUPS))
  for (const name of stale) {
    await fs.rm(path.join(root, name), { recursive: true, force: true })
  }
}

async function writeTextAtomic(file, content) {
  await ensureDir(path.dirname(file))
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`)
  await fs.writeFile(temp, content, 'utf8')
  await fs.rename(temp, file)
}

function isManagedId(id) {
  const normalized = String(id).replaceAll('\\', '/')
  return MANAGED_DIRECTORIES.some(directory => normalized.startsWith(`${directory}/`))
    && !normalized.split('/').includes('..')
}

function toPortableRelative(base, target) {
  return path.relative(base, target).split(path.sep).join('/')
}

function backupStamp() {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`
}

function similarity(current, source) {
  const currentLines = new Set(current.split('\n').map(line => line.trim()).filter(Boolean))
  const sourceLines = [...new Set(source.split('\n').map(line => line.trim()).filter(Boolean))]
  if (sourceLines.length === 0) return 1
  const common = sourceLines.filter(line => currentLines.has(line)).length
  return common / sourceLines.length
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

async function toolVersion() {
  try {
    const pkg = await readJson(new URL('../../package.json', import.meta.url))
    return typeof pkg?.version === 'string' ? pkg.version : 'unknown'
  } catch {
    return 'unknown'
  }
}
