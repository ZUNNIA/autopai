import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from '../lib/git.js'
import * as github from '../lib/github.js'
import { runSession } from '../lib/session.js'
import { runGates } from '../lib/gates.js'
import { Artifacts } from '../lib/artifacts.js'
import { scopesFromState, lastMergedScopes } from '../lib/defaults.js'
import { listCodeFiles } from '../lib/codefiles.js'
import { chunkCodeFiles } from '../lib/chunks.js'
import { slugify, walkFiles, ensureDir } from '../lib/util.js'

/**
 * Resolves one or more audit scopes (branch, pull request, or directory),
 * gathers local evidence, and runs the read-only auditor. No diagnostic report
 * is produced: the auditor writes only Identified tickets. Without --scope the
 * scopes come from the previous run state or the current branch.
 */
export async function runIdentify({ config, stateStore, options, log }) {
  const previous = await stateStore.load()
  const scopes = await resolveScopes({ config, options, previous })
  if (scopes.length === 0) {
    throw new Error('No audit scope could be resolved. Pass --scope branch:<name> or --scope pr:<number>.')
  }

  const feature = String(options.feature ?? previous?.feature ?? '').trim() || null
  const state = await stateStore.create('identify', { feature })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()

  const resolvedScopes = []
  for (const scope of scopes) {
    const resolved = await resolveScope({ config, artifacts, scope })
    for (const item of resolved) {
      resolvedScopes.push(item)
      await log?.(`Scope ${item.name}: ${item.changedFiles.length} files.`)
    }
  }

  if (options.dryRun) {
    return {
      dryRun: true,
      scopes: resolvedScopes.map(scope => ({ name: scope.name, kind: scope.kind, changedFiles: scope.changedFiles.length })),
      message: 'Dry run: no evidence collection, no auditor session, and no ticket writes were performed.'
    }
  }

  const uncommitted = await git.statusTrackedPorcelain(config.repoPath)
  if (uncommitted !== '') {
    throw new Error(`The working tree has uncommitted tracked changes. Commit or stash them before identifying:\n${uncommitted}`)
  }

  const gates = await runGates({ config, artifacts, prefix: 'evidence' })
  await log?.(`Evidence gates: ${gates.ok ? 'passed' : gates.reason}`)

  const runtimeLogs = await collectRuntimeLogs(config, artifacts)
  const evidence = {
    generatedAt: new Date().toISOString(),
    gates: { ok: gates.ok, reason: gates.reason ?? null, coverage: gates.coverage ? gates.coverage.rate : null },
    runtimeLogs,
    notes: 'Local evidence only. Do not create a diagnostic report.'
  }
  const evidenceFile = await artifacts.write('evidence.json', JSON.stringify(evidence, null, 2))

  for (const resolved of resolvedScopes) {
    const outputDir = path.join(config.repoPath, config.ticketDirs.identified, resolved.name)
    await ensureDir(outputDir)
    const payload = {
      scope: resolved.name,
      kind: resolved.kind,
      patchPath: resolved.patchPath,
      changedFiles: resolved.changedFiles,
      evidenceFile,
      outputDir,
      instructions: 'Write one Identified ticket per debt under outputDir. No source edits, no UX changes, no diagnostic report.'
    }
    const execution = await runSession({
      config,
      prompt: 'identified',
      agent: config.agents.auditor,
      payload,
      title: `AutopAI identify ${resolved.name}`,
      logFile: artifacts.path(`auditor-${slugify(resolved.name)}.log`),
      role: 'auditor'
    })
    if (execution.code !== 0) {
      throw new Error(`Auditor failed for scope ${resolved.name} with exit code ${execution.code}.`)
    }
    resolved.tickets = await walkFiles(outputDir, file => file.endsWith('.md'))
    await log?.(`Scope ${resolved.name}: ${resolved.tickets.length} Identified tickets.`)
  }

  const dirty = await git.statusTrackedPorcelain(config.repoPath)
  if (dirty !== '') {
    throw new Error(`The auditor modified tracked files. Review the working tree:\n${dirty}`)
  }

  state.phase = 'identified'
  state.completedPhases = [...new Set([...state.completedPhases, 'identify'])]
  state.scopes = resolvedScopes.map(scope => ({
    name: scope.name,
    kind: scope.kind,
    changedFiles: scope.changedFiles,
    patch: scope.patchPath,
    tickets: scope.tickets
  }))
  await stateStore.save(state)

  return {
    runId: state.runId,
    scopes: resolvedScopes.map(scope => ({ name: scope.name, tickets: scope.tickets.length, files: scope.changedFiles.length })),
    evidence: evidenceFile,
    localOnly: true
  }
}

function normalizeScopes(value) {
  if (!value) return []
  const list = Array.isArray(value) ? value : [value]
  return list.map(item => String(item).trim()).filter(Boolean)
}

async function resolveScopes({ config, options, previous }) {
  const explicit = normalizeScopes(options.scope)
  if (explicit.length > 0) return explicit

  if (options.last !== undefined) {
    const count = options.last === true ? 1 : Number(options.last)
    if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid --last value: ${options.last}. Use a positive integer.`)
    const prs = await github.prListMerged(config.repoPath, config.baseBranch, Math.max(count, 100))
    const scopes = lastMergedScopes(prs, count)
    if (scopes.length === 0) throw new Error(`No merged pull requests were found on ${config.baseBranch}.`)
    return scopes
  }

  const fromState = scopesFromState(previous)
  if (fromState.length > 0) return fromState
  if (previous?.branch) return [`branch:${previous.branch}`]

  const branch = await git.currentBranch(config.repoPath)
  if (branch && branch !== config.baseBranch && await git.countCommitsOver(config.repoPath, config.baseBranch, branch) > 0) {
    return [`branch:${branch}`]
  }
  return []
}

async function resolveScope({ config, artifacts, scope }) {
  const [kind, ...rest] = scope.includes(':') ? scope.split(':') : ['branch', scope]
  const value = rest.join(':')

  if (kind === 'pr') {
    const number = Number(value)
    if (!number) throw new Error(`Invalid PR scope: ${scope}`)
    const patch = await github.prDiff(config.repoPath, number)
    const files = await github.prFiles(config.repoPath, number)
    const patchPath = await artifacts.write(`scope-${number}.patch`, patch)
    const changedFiles = files.map(file => file.path)
    await artifacts.write(`scope-${number}.files`, changedFiles.join('\n'))
    return [{ name: `pr-${number}`, kind, changedFiles, patchPath }]
  }

  if (kind === 'dir') {
    const target = path.resolve(config.repoPath, value)
    const relativeDir = path.relative(config.repoPath, target).replace(/\\/g, '/') || '.'
    if (relativeDir.startsWith('..')) throw new Error(`The directory must be inside the repository: ${value}`)
    const files = await listCodeFiles(config.repoPath, relativeDir)
    if (files.length === 0) throw new Error(`No code files were found under ${relativeDir} (ignored paths are excluded).`)
    const resolved = []
    for (const chunk of chunkCodeFiles(files, config.auditChunkFiles)) {
      await artifacts.write(`scope-${chunk.name}.files`, chunk.files.join('\n'))
      resolved.push({ name: chunk.name, kind: 'dir', changedFiles: chunk.files, patchPath: null })
    }
    return resolved
  }

  const branch = value
  const baseBranch = config.baseBranch
  await git.fetch(config.repoPath)
  const patch = await git.diff(config.repoPath, `origin/${baseBranch}...${branch}`)
  const changedFiles = await git.diffNames(config.repoPath, `origin/${baseBranch}...${branch}`)
  const patchPath = await artifacts.write(`scope-${slugify(branch)}.patch`, patch)
  await artifacts.write(`scope-${slugify(branch)}.files`, changedFiles.join('\n'))
  return [{ name: slugify(branch), kind: 'branch', changedFiles, patchPath }]
}

async function collectRuntimeLogs(config, artifacts) {
  const collected = []
  const targetDir = path.join(artifacts.dir, 'runtime-logs')
  await ensureDir(targetDir)
  for (const pattern of config.runtimeLogs ?? []) {
    const matches = await expandGlob(pattern)
    for (const match of matches.slice(-5)) {
      const target = path.join(targetDir, path.basename(match))
      await fs.copyFile(match, target)
      collected.push(target)
    }
  }
  return collected
}

async function expandGlob(pattern) {
  const dir = path.dirname(pattern)
  const base = path.basename(pattern)
  if (!base.includes('*')) {
    try {
      const stat = await fs.stat(pattern)
      return stat.isFile() ? [pattern] : []
    } catch {
      return []
    }
  }
  const regex = new RegExp(`^${base.split('*').map(escapeRegExp).join('.*')}$`)
  let entries = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  const matches = []
  for (const entry of entries) {
    if (!regex.test(entry)) continue
    const full = path.join(dir, entry)
    try {
      const stat = await fs.stat(full)
      if (stat.isFile()) matches.push({ file: full, mtime: stat.mtimeMs })
    } catch {
      // Ignore files that disappear between readdir and stat.
    }
  }
  return matches.sort((left, right) => left.mtime - right.mtime).map(item => item.file)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
