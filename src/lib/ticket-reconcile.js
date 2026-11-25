import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { validateReadyForRefactorText } from './artifact-contracts.js'
import { listBlockers } from './blockers.js'
import { fromRepoRelative, toRepoRelative } from './portable-paths.js'
import { StateStore } from './state.js'
import { parseTicket } from './tickets.js'
import { atomicWriteJson, ensureDir, exists, walkFiles } from './util.js'

const PLAN_KEYS = new Set(['schemaVersion', 'moves', 'dependencyUpdates', 'findings', 'blockers', 'edits'])
const MOVE_ACTIONS = new Set(['done', 'archive'])
const ARCHIVE_ACTIONS = new Set(['archive'])

/**
 * Reads the local ticket state without writing. The report is the factual input
 * for a founder-approved reconciliation plan: it never guesses which ticket is
 * a duplicate, it only exposes the queue, the done ids, the blockers and the
 * dependencies that currently do not resolve.
 */
export async function inspectTickets(config) {
  const repo = path.resolve(config.repoPath)
  const readyRoot = path.resolve(repo, config.ticketDirs.readyForRefactor)
  const doneRoot = path.resolve(repo, config.ticketDirs.done)
  const identifiedRoot = path.resolve(repo, config.ticketDirs.identified)
  const ready = await readTicketInventory(repo, readyRoot)
  const done = await readTicketInventory(repo, doneRoot)
  const blockers = await listBlockers(config)
  const known = new Set([...ready, ...done].flatMap(ticket => [ticket.id, ticket.slug]))
  const unresolvedDependencies = []
  for (const ticket of ready) {
    for (const dependency of ticket.dependsOn) {
      if (!known.has(dependency)) unresolvedDependencies.push({ file: ticket.file, id: ticket.id, dependency })
    }
  }
  const identified = []
  for (const file of await walkFiles(identifiedRoot, candidate => candidate.endsWith('.md'))) {
    const text = await fs.readFile(file, 'utf8')
    identified.push({
      file: toRepoRelative(repo, file) ?? file,
      title: firstHeading(text) ?? path.basename(file, '.md')
    })
  }
  return {
    activeRun: await new StateStore(config).isActiveRun(),
    readyForRefactor: ready,
    done,
    identified,
    blockers: blockers.map(blocker => ({
      file: toRepoRelative(repo, blocker.file) ?? blocker.file,
      reason: blocker.reason ?? null,
      decision: blocker.decision ?? null,
      suggestedAction: blocker.suggestedAction ?? null,
      valid: blocker.valid
    })),
    duplicateIds: groupsBy([...ready, ...done], ticket => ticket.id),
    duplicateTitleGroups: groupsBy([...ready, ...done], ticket => normalizeTitle(ticket.title)),
    unresolvedDependencies
  }
}

/**
 * Loads and validates a reconciliation plan. The plan is JSON, describes only
 * operations AutopAI can verify, and is rejected before any write when a path,
 * action, dependency or exact edit is unsafe.
 */
export async function readReconcilePlan(planFile) {
  const target = path.resolve(String(planFile ?? ''))
  let raw
  try {
    raw = JSON.parse(await fs.readFile(target, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Reconciliation plan not found: ${target}`)
    throw new Error(`Could not read the reconciliation plan ${target}: ${error.message}`)
  }
  return { file: target, raw }
}

export async function reconcileTickets(config, rawPlan, options = {}) {
  const apply = options.apply === true
  if (apply && options.confirm !== true) {
    throw new Error('Applying a reconciliation plan requires explicit confirmation.')
  }
  const prepared = await prepareReconcile(config, rawPlan, options)
  if (!apply) return publicPrepared(prepared)
  return applyReconcile(config, prepared)
}

/**
 * Builds the complete operation list and verifies the final queue in memory.
 * The caller can apply the result or use the dry-run output for review.
 */
export async function prepareReconcile(config, rawPlan, options = {}) {
  const repo = path.resolve(config.repoPath)
  const readyRoot = path.resolve(repo, config.ticketDirs.readyForRefactor)
  const doneRoot = path.resolve(repo, config.ticketDirs.done)
  const identifiedRoot = path.resolve(repo, config.ticketDirs.identified)
  const stateRoot = path.resolve(config.stateDir)
  const plan = normalizePlan(config, rawPlan, options.planFile ?? null)
  const ready = await readTicketMap(config, readyRoot)
  const done = await readTicketMap(config, doneRoot)
  const blockers = new Map((await listBlockers(config)).map(blocker => [path.resolve(blocker.file), blocker]))
  const movedFiles = new Set(plan.moves.map(move => move.abs))
  const operations = []
  const working = new Map([...ready].map(([file, ticket]) => [file, { ...ticket }]))
  const doneTickets = [...done.values()].map(entry => entry.ticket)

  for (const move of plan.moves) {
    const source = ready.get(move.abs)
    const target = move.action === 'done'
      ? path.join(doneRoot, safeFeature(move.feature ?? source?.ticket.feature), path.basename(move.abs))
      : path.join(stateRoot, 'superseded', 'ready-for-refactor', path.relative(readyRoot, move.abs))
    if (!source) {
      if (await exists(target)) {
        const targetTicket = parseTicket(await fs.readFile(target, 'utf8'), target)
        if (move.id && targetTicket.id !== move.id) {
          throw new Error(`The archived ticket ${relative(repo, target)} has id ${targetTicket.id}, not ${move.id}.`)
        }
        if (move.action === 'done') doneTickets.push(targetTicket)
        operations.push(moveOperation(repo, move, target, true))
        continue
      }
      throw new Error(`Ticket not found for ${move.action}: ${move.relative}`)
    }
    working.delete(move.abs)
    if (move.action === 'done') doneTickets.push(source.ticket)
    operations.push(moveOperation(repo, move, target, false))
  }

  for (const update of plan.dependencyUpdates) {
    if (movedFiles.has(update.abs)) throw new Error(`Cannot update dependencies on moved ticket ${update.relative}.`)
    const entry = working.get(update.abs)
    if (!entry) throw new Error(`Ticket not found for dependency update: ${update.relative}`)
    entry.text = updateDependsOn(entry.text, update)
    entry.ticket = parseTicket(entry.text, entry.abs)
    validateReadyForRefactorText(entry.text, { file: entry.relative })
    operations.push({ kind: 'write', file: update.relative, abs: update.abs, text: entry.text })
  }

  for (const edit of plan.edits) {
    if (movedFiles.has(edit.abs)) throw new Error(`Cannot edit moved ticket ${edit.relative}.`)
    const entry = working.get(edit.abs)
    if (!entry) throw new Error(`Ticket not found for edit: ${edit.relative}`)
    const before = entry.ticket.id
    entry.text = applyExactEdit(entry.text, edit)
    entry.ticket = parseTicket(entry.text, entry.abs)
    if (entry.ticket.id !== before) throw new Error(`Edit would change the ticket id in ${edit.relative}.`)
    validateReadyForRefactorText(entry.text, { file: edit.relative })
    operations.push({ kind: 'write', file: edit.relative, abs: edit.abs, text: entry.text })
  }

  for (const finding of plan.findings) {
    const target = path.join(stateRoot, 'superseded', 'identified', path.relative(identifiedRoot, finding.abs))
    if (!await exists(finding.abs) && await exists(target)) {
      operations.push(findingOperation(repo, finding, target, true))
      continue
    }
    if (!await exists(finding.abs)) throw new Error(`Finding not found: ${finding.relative}`)
    operations.push(findingOperation(repo, finding, target, false))
  }

  for (const blocker of plan.blockers) {
    if (!await exists(blocker.abs) && await findArchivedBlocker(stateRoot, path.basename(blocker.abs))) {
      operations.push(blockerOperation(repo, blocker, path.join(stateRoot, 'resolved-blockers', path.basename(blocker.abs)), true))
      continue
    }
    if (!blockers.has(blocker.abs)) throw new Error(`Blocker not found: ${blocker.relative}`)
    const target = path.join(stateRoot, 'resolved-blockers', `${stamp()}-${path.basename(blocker.abs)}`)
    operations.push(blockerOperation(repo, blocker, target, false))
  }

  const verification = verifyQueue({
    ready: [...working.values()].map(entry => entry.ticket),
    done: doneTickets
  })
  if (!verification.ok) throw new Error(`The reconciliation plan leaves an invalid queue:\n${verification.errors.join('\n')}`)

  return {
    plan: {
      file: plan.file,
      hash: plan.file ? await hashFile(plan.file) : null,
      operations: operations.length
    },
    operations,
    verification
  }
}

function publicPrepared(prepared) {
  return {
    plan: prepared.plan,
    operations: prepared.operations.map(operation => serializableOperation(operation)),
    verification: prepared.verification,
    applied: false
  }
}

async function applyReconcile(config, prepared) {
  const repo = path.resolve(config.repoPath)
  const stateRoot = path.resolve(config.stateDir)
  const runDir = path.join(stateRoot, 'reconcile', `${stamp()}-${process.pid}`)
  const backupDir = path.join(runDir, 'backup')
  const journalFile = path.join(runDir, 'journal.json')
  if (!prepared.plan.file) throw new Error('Applying a reconciliation plan requires the plan file path.')
  const sourceFiles = [...new Set(prepared.operations
    .filter(operation => !operation.idempotent && (operation.kind === 'write' || operation.kind === 'move'))
    .map(operation => path.resolve(operation.abs ?? operation.from)))]
  for (const source of sourceFiles) {
    await copyFile(source, path.join(backupDir, backupRelative(repo, source)))
  }
  await copyFile(prepared.plan.file, path.join(runDir, 'plan.json'))
  const journal = {
    schemaVersion: 1,
    status: 'pending',
    startedAt: new Date().toISOString(),
    plan: prepared.plan,
    operations: prepared.operations.map(operation => serializableOperation(operation)),
    backupDir,
    verification: prepared.verification
  }
  await atomicWriteJson(journalFile, journal)
  const applied = []
  try {
    for (const operation of prepared.operations) {
      if (operation.idempotent) continue
      if (operation.kind === 'write') {
        const current = await fs.readFile(operation.abs, 'utf8')
        if (current !== operation.text) await writeTextAtomic(operation.abs, operation.text)
        applied.push(operation)
        continue
      }
      await moveFile(operation.from, operation.to)
      applied.push(operation)
    }
    const verification = await verifyQueueFromDisk(config)
    if (!verification.ok) throw new Error(`Post-apply verification failed:\n${verification.errors.join('\n')}`)
    journal.status = 'applied'
    journal.finishedAt = new Date().toISOString()
    journal.verification = verification
    await atomicWriteJson(journalFile, journal)
    return {
      ...prepared,
      applied: true,
      backupDir,
      journal: journalFile,
      verification
    }
  } catch (error) {
    const rollbackErrors = []
    for (const operation of [...applied].reverse()) {
      try {
        if (operation.kind === 'write') {
          await copyFile(
            path.join(backupDir, backupRelative(repo, operation.abs)),
            operation.abs
          )
          continue
        }
        if (await exists(operation.to) && !await exists(operation.from)) {
          await moveFile(operation.to, operation.from)
        }
      } catch (rollbackError) {
        rollbackErrors.push(`${operation.kind} ${operation.file}: ${rollbackError.message}`)
      }
    }
    journal.status = rollbackErrors.length === 0 ? 'rolled-back' : 'rollback-failed'
    journal.finishedAt = new Date().toISOString()
    journal.error = error.message
    journal.rollbackErrors = rollbackErrors
    await atomicWriteJson(journalFile, journal)
    const suffix = rollbackErrors.length === 0
      ? ''
      : `\nRollback also failed:\n${rollbackErrors.join('\n')}`
    throw new Error(`${error.message}${suffix}\nJournal: ${journalFile}`)
  }
}

export async function verifyQueueFromDisk(config) {
  const repo = path.resolve(config.repoPath)
  const ready = await readTicketInventory(repo, path.resolve(repo, config.ticketDirs.readyForRefactor))
  const done = await readTicketInventory(repo, path.resolve(repo, config.ticketDirs.done))
  return verifyQueue({ ready, done })
}

/**
 * Verifies the invariants the refactor queue relies on. A pending ticket may
 * depend only on a pending ticket or on work already present in done, and an id
 * or slug may not appear twice across ready and done.
 */
export function verifyQueue({ ready = [], done = [] } = {}) {
  const errors = []
  const readyIds = new Set()
  const readySlugs = new Set()
  for (const ticket of ready) {
    if (readyIds.has(ticket.id)) errors.push(`Duplicate ready ticket id ${ticket.id}.`)
    if (readySlugs.has(ticket.slug)) errors.push(`Duplicate ready ticket slug ${ticket.slug}.`)
    readyIds.add(ticket.id)
    readySlugs.add(ticket.slug)
  }
  const doneIds = new Set()
  const doneSlugs = new Set()
  for (const ticket of done) {
    if (readyIds.has(ticket.id)) errors.push(`Ticket id ${ticket.id} exists in both ready and done.`)
    if (readySlugs.has(ticket.slug)) errors.push(`Ticket slug ${ticket.slug} exists in both ready and done.`)
    doneIds.add(ticket.id)
    doneSlugs.add(ticket.slug)
  }
  const known = new Set([...readyIds, ...readySlugs, ...doneIds, ...doneSlugs])
  for (const ticket of ready) {
    for (const dependency of ticket.dependsOn) {
      if (!known.has(dependency)) {
        errors.push(`Ticket ${ticket.id} depends on unknown ticket ${dependency}.`)
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

function normalizePlan(config, raw, planFile = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('The reconciliation plan must be a JSON object.')
  }
  for (const key of Object.keys(raw)) {
    if (!PLAN_KEYS.has(key)) throw new Error(`Unknown reconciliation plan field: ${key}.`)
  }
  if (Number(raw.schemaVersion) !== 1) throw new Error('The reconciliation plan schemaVersion must be 1.')
  const readyRoot = path.resolve(config.repoPath, config.ticketDirs.readyForRefactor)
  const identifiedRoot = path.resolve(config.repoPath, config.ticketDirs.identified)
  const stateRoot = path.resolve(config.stateDir)
  const seen = new Set()
  const unique = (abs, label) => {
    if (seen.has(abs)) throw new Error(`The reconciliation plan references ${label} twice.`)
    seen.add(abs)
  }
  return {
    file: String(planFile ?? ''),
    moves: asArray(raw.moves, 'moves').map(item => {
      const target = resolveInside(config, item.file, 'move file')
      assertUnder(readyRoot, target.abs, 'move file')
      const action = String(item.action ?? '').trim()
      if (!MOVE_ACTIONS.has(action)) throw new Error(`Invalid move action for ${target.relative}: ${action}.`)
      unique(target.abs, target.relative)
      return {
        ...target,
        action,
        id: optionalString(item.id),
        feature: optionalString(item.feature),
        duplicateOf: optionalString(item.duplicateOf),
        reason: optionalString(item.reason)
      }
    }),
    dependencyUpdates: asArray(raw.dependencyUpdates, 'dependencyUpdates').map(item => {
      const target = resolveInside(config, item.file, 'dependency update file')
      assertUnder(readyRoot, target.abs, 'dependency update file')
      const remove = stringList(item.remove, 'dependency update remove')
      const add = stringList(item.add, 'dependency update add')
      if (remove.length === 0 && add.length === 0) {
        throw new Error(`The dependency update for ${target.relative} removes and adds nothing.`)
      }
      return { ...target, remove, add }
    }),
    edits: asArray(raw.edits, 'edits').map(item => {
      const target = resolveInside(config, item.file, 'edit file')
      assertUnder(readyRoot, target.abs, 'edit file')
      const find = requiredString(item.find, 'edit find')
      const replace = String(item.replace ?? '')
      const expectedCount = item.expectedCount === undefined ? 1 : Number(item.expectedCount)
      if (!Number.isInteger(expectedCount) || expectedCount < 0) {
        throw new Error(`The edit expectedCount for ${target.relative} must be a non-negative integer.`)
      }
      return { ...target, find, replace, expectedCount }
    }),
    findings: asArray(raw.findings, 'findings').map(item => {
      const target = resolveInside(config, item.file, 'finding file')
      assertUnder(identifiedRoot, target.abs, 'finding file')
      const action = String(item.action ?? '').trim()
      if (!ARCHIVE_ACTIONS.has(action)) throw new Error(`Invalid finding action for ${target.relative}: ${action}.`)
      unique(target.abs, target.relative)
      return { ...target, action, reason: optionalString(item.reason) }
    }),
    blockers: asArray(raw.blockers, 'blockers').map(item => {
      const target = resolveStateFile(config, item.file)
      const action = String(item.action ?? '').trim()
      if (!ARCHIVE_ACTIONS.has(action)) throw new Error(`Invalid blocker action for ${target.relative}: ${action}.`)
      unique(target.abs, target.relative)
      return { ...target, action, reason: optionalString(item.reason) }
    })
  }
}

function updateDependsOn(text, update) {
  const match = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) throw new Error(`Missing YAML front matter in ${update.relative}.`)
  const newline = match[1].includes('\r\n') ? '\r\n' : '\n'
  const lines = match[1].split(/\r?\n/)
  const index = lines.findIndex(line => /^depends_on:\s*(.*)$/.test(line))
  if (index < 0) throw new Error(`Missing depends_on in ${update.relative}.`)
  const inline = lines[index].match(/^depends_on:\s*(.*)$/)[1].trim()
  let current = []
  let end = index + 1
  if (inline) {
    current = inline.replace(/^\[|\]$/g, '').split(',').map(item => item.trim()).filter(Boolean)
  } else {
    while (end < lines.length && /^\s*-\s+/.test(lines[end])) {
      current.push(lines[end].replace(/^\s*-\s+/, '').trim())
      end += 1
    }
  }
  const removed = new Set(update.remove)
  const next = current.filter(item => !removed.has(item))
  for (const dependency of update.add) {
    if (!next.includes(dependency)) next.push(dependency)
  }
  lines.splice(index, end - index, `depends_on: [${next.join(', ')}]`)
  const block = lines.join(newline)
  const nextText = String(text).replace(match[1], block)
  return nextText
}

function applyExactEdit(text, edit) {
  const count = String(text).split(edit.find).length - 1
  if (count === edit.expectedCount) return String(text).split(edit.find).join(edit.replace)
  if (count === 0 && edit.replace && String(text).includes(edit.replace)) return String(text)
  throw new Error(`Edit text occurs ${count} time(s) in ${edit.relative}; expected ${edit.expectedCount}.`)
}

async function readTicketInventory(repo, root) {
  const tickets = []
  for (const file of await walkFiles(root, candidate => candidate.endsWith('.md'))) {
    const text = await fs.readFile(file, 'utf8')
    tickets.push(serializableTicket(repo, parseTicket(text, file), file))
  }
  return tickets.sort((left, right) => left.file.localeCompare(right.file))
}

async function readTicketMap(config, root) {
  const map = new Map()
  for (const file of await walkFiles(root, candidate => candidate.endsWith('.md'))) {
    const abs = path.resolve(file)
    const text = await fs.readFile(abs, 'utf8')
    map.set(abs, {
      abs,
      file: toRepoRelative(config.repoPath, abs) ?? abs,
      relative: toRepoRelative(config.repoPath, abs) ?? abs,
      text,
      ticket: parseTicket(text, abs)
    })
  }
  return map
}

function serializableTicket(repo, ticket, file) {
  return {
    file: toRepoRelative(repo, file) ?? file,
    id: ticket.id,
    slug: ticket.slug,
    title: ticket.title,
    feature: ticket.feature,
    priority: ticket.priority,
    dependsOn: ticket.dependsOn
  }
}

function moveOperation(repo, move, target, idempotent) {
  return {
    kind: 'move',
    action: move.action,
    file: move.relative,
    from: move.abs,
    to: target,
    relativeTarget: toRepoRelative(repo, target) ?? target,
    duplicateOf: move.duplicateOf,
    reason: move.reason,
    idempotent
  }
}

function findingOperation(repo, finding, target, idempotent) {
  return {
    kind: 'move',
    action: 'archive-finding',
    file: finding.relative,
    from: finding.abs,
    to: target,
    relativeTarget: toRepoRelative(repo, target) ?? target,
    reason: finding.reason,
    idempotent
  }
}

function blockerOperation(repo, blocker, target, idempotent) {
  return {
    kind: 'move',
    action: 'archive-blocker',
    file: blocker.relative,
    from: blocker.abs,
    to: target,
    relativeTarget: toRepoRelative(repo, target) ?? target,
    reason: blocker.reason,
    idempotent
  }
}

function serializableOperation(operation) {
  return {
    kind: operation.kind,
    action: operation.action ?? null,
    file: operation.file,
    to: operation.relativeTarget ?? null,
    duplicateOf: operation.duplicateOf ?? null,
    reason: operation.reason ?? null,
    idempotent: operation.idempotent === true
  }
}

function resolveInside(config, value, label) {
  const target = resolveRepoPath(config, value, label)
  return target
}

function resolveRepoPath(config, value, label) {
  const text = requiredString(value, label)
  const abs = path.isAbsolute(text) ? path.normalize(text) : path.resolve(config.repoPath, text)
  const relative = toRepoRelative(config.repoPath, abs)
  if (!relative) throw new Error(`${label} must be inside the repository: ${text}`)
  return { abs, relative }
}

function resolveStateFile(config, value) {
  const text = requiredString(value, 'blocker file')
  const stateRoot = path.resolve(config.stateDir)
  const abs = path.isAbsolute(text) ? path.normalize(text) : path.resolve(config.repoPath, text)
  const relativeToState = path.relative(stateRoot, abs)
  if (relativeToState.startsWith('..') || path.isAbsolute(relativeToState)) {
    throw new Error(`Blocker file must be inside the state directory: ${text}`)
  }
  const normalized = relativeToState.split(path.sep).join('/')
  if (!normalized.startsWith('needs-human/')) {
    throw new Error(`Blocker file must be inside needs-human: ${text}`)
  }
  return {
    abs,
    relative: toRepoRelative(config.repoPath, abs) ?? abs
  }
}

function assertUnder(root, abs, label) {
  const relative = path.relative(root, abs)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must be inside ${root}.`)
  }
}

function safeFeature(value) {
  const feature = String(value ?? '').trim()
  if (!feature) return 'tech-debt'
  if (!/^[A-Za-z0-9._-]+$/.test(feature)) throw new Error(`Invalid ticket feature: ${feature}.`)
  return feature
}

function asArray(value, label) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`The reconciliation plan field ${label} must be an array.`)
  return value
}

function stringList(value, label) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`The reconciliation plan field ${label} must be an array.`)
  return value.map(item => requiredString(item, label))
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`The reconciliation plan field ${label} must be a non-empty string.`)
  return value.trim()
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function groupsBy(items, keyOf) {
  const groups = new Map()
  for (const item of items) {
    const key = keyOf(item)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item.file)
  }
  return [...groups.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([key, files]) => ({ key, files }))
}

function normalizeTitle(value) {
  const text = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(ui|ui2|ui3|training|scripts)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || null
}

function firstHeading(text) {
  const match = String(text).match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}

async function findArchivedBlocker(stateRoot, basename) {
  const dir = path.join(stateRoot, 'resolved-blockers')
  if (!await exists(dir)) return null
  const files = await walkFiles(dir, file => file.endsWith(basename))
  return files[0] ?? null
}

async function hashFile(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')
}

function stamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 17)
}

function relative(repo, file) {
  return path.relative(repo, file).split(path.sep).join('/')
}

function backupRelative(repo, file) {
  const rel = path.relative(repo, file)
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return rel
  return path.join('external', crypto.createHash('sha256').update(file).digest('hex').slice(0, 8), path.basename(file))
}

async function writeTextAtomic(file, text) {
  await ensureDir(path.dirname(file))
  const temp = `${file}.${process.pid}.tmp`
  await fs.writeFile(temp, text, 'utf8')
  await fs.rename(temp, file)
}

async function moveFile(from, to) {
  await ensureDir(path.dirname(to))
  if (!await exists(from)) {
    if (await exists(to)) return
    throw new Error(`Missing source file: ${from}`)
  }
  try {
    await fs.rename(from, to)
  } catch (error) {
    if (error.code !== 'EXDEV') throw error
    await fs.copyFile(from, to)
    await fs.unlink(from)
  }
}

async function copyFile(from, to) {
  await ensureDir(path.dirname(to))
  await fs.copyFile(from, to)
}
