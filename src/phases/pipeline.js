import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from '../lib/git.js'
import { runSession, deleteSession } from '../lib/session.js'
import { scanBranch, formatViolations } from '../lib/policy.js'
import { runGates, gateFailureText } from '../lib/gates.js'
import { generatePrBody, ticketTitle } from '../lib/title.js'
import { pushOpenWaitMerge } from '../lib/pr.js'
import { Artifacts } from '../lib/artifacts.js'
import { archiveBlockers, listBlockers, blockerMessage } from '../lib/blockers.js'
import { blockedDependents, collectManualVerification, filterFindingFiles, filterTicketsByFeature, listTickets, moveTicket, orderTickets, resolveTicketBranch, selectTickets, ticketDoneDir } from '../lib/tickets.js'
import { describeFilters, filterTickets, hasFilters, normalizeFilters } from '../lib/filters.js'
import { featureFromDescription, resolveFeature } from '../lib/defaults.js'
import { selectPromotionGroups, stateFindingGroups } from '../lib/promotion.js'
import { mergePrepareSession, prepareSessionRecord, prepareSessionsToDelete, recoverPrepareReview } from '../lib/prepare-review.js'
import { ensureDir, slugify } from '../lib/util.js'

export async function runPrepare({ config, stateStore, options, log }) {
  const feature = resolvePrepareFeature(options)
  const backlogDir = path.join(config.repoPath, config.ticketDirs.backlog, feature)
  const briefPath = path.join(backlogDir, 'brief.md')
  await ensureDir(backlogDir)

  const recovered = await recoverPrepareReview({ config, stateStore, log, feature })
  if (recovered) {
    const backlogFiles = await listMarkdown(backlogDir)
    await log?.(`Backlog ready for review at ${backlogDir}.`)
    return {
      feature,
      backlogDir,
      backlogFiles,
      phase: 'awaiting_approval',
      sessions: recovered.sessions ?? [],
      plannerMessages: [],
      recovered: true
    }
  }

  const plannerMessages = []
  const previous = await stateStore.load()
  const state = previous?.mode === 'prepare' && previous.feature === feature
    ? previous
    : await stateStore.create('prepare', { feature, phase: 'backlog' })
  state.phase = 'backlog'
  await stateStore.save(state)
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()

  if (!await exists(briefPath)) {
    if (!options.description) {
      throw new Error(`Missing ${briefPath}. Provide --description or run /feature-brief before prepare.`)
    }
    const briefRun = await runSession({
      config,
      prompt: 'feature-brief',
      agent: config.agents.planner,
      payload: { feature, description: String(options.description), briefPath },
      title: `AutopAI brief ${feature}`,
      logFile: artifacts.path('planner-brief.log'),
      role: 'planner',
      retainSession: true
    })
    state.sessions = mergePrepareSession(state.sessions, prepareSessionRecord({
      kind: 'brief',
      feature,
      session: briefRun.session,
      title: `AutopAI brief ${feature}`
    }))
    if (briefRun.stdout?.trim()) plannerMessages.push({ kind: 'brief', text: briefRun.stdout.trim() })
    await stateStore.save(state)
    if (briefRun.code !== 0) throw new Error('The planner could not write the feature brief.')
  }

  const backlogRun = await runSession({
    config,
    prompt: 'backlog',
    agent: config.agents.planner,
    payload: { feature, briefPath, outputDir: backlogDir },
    title: `AutopAI backlog ${feature}`,
    logFile: artifacts.path('planner-backlog.log'),
    role: 'planner',
    retainSession: true
  })
  state.sessions = mergePrepareSession(state.sessions, prepareSessionRecord({
    kind: 'backlog',
    feature,
    session: backlogRun.session,
    title: `AutopAI backlog ${feature}`
  }))
  if (backlogRun.stdout?.trim()) plannerMessages.push({ kind: 'backlog', text: backlogRun.stdout.trim() })
  if (backlogRun.code !== 0) {
    await stateStore.save(state)
    throw new Error('The planner could not generate the backlog.')
  }

  state.phase = 'awaiting_approval'
  state.completedPhases = [...new Set([...state.completedPhases, 'prepare', 'backlog'])]
  await stateStore.save(state)

  const backlogFiles = await listMarkdown(backlogDir)
  await log?.(`Backlog ready for review at ${backlogDir}.`)
  return {
    feature,
    backlogDir,
    backlogFiles,
    phase: 'awaiting_approval',
    sessions: state.sessions ?? [],
    plannerMessages
  }
}

export async function runApprove({ config, stateStore, options, log }) {
  const recovered = await recoverPrepareReview({ config, stateStore, log })
  const previous = recovered ?? await stateStore.load()
  const feature = await resolveFeature({ config, options, state: previous, dirs: [config.ticketDirs.backlog] })
  const backlogDir = path.join(config.repoPath, config.ticketDirs.backlog, feature)
  if (!await exists(backlogDir)) throw new Error(`No backlog found for feature ${feature}. Run prepare first.`)

  const readyDir = path.join(config.repoPath, config.ticketDirs.readyForDev, feature)
  await ensureDir(readyDir)
  const artifacts = new Artifacts(config, `approve-${Date.now()}`)
  await artifacts.init()

  const generated = await runSession({
    config,
    prompt: 'ready-for-dev',
    agent: config.agents.planner,
    payload: { feature, backlogDir, outputDir: readyDir },
    title: `AutopAI ready-for-dev ${feature}`,
    logFile: artifacts.path('planner-ready-for-dev.log'),
    role: 'planner'
  })
  if (generated.code !== 0) throw new Error('The planner could not generate ready-for-dev tickets.')

  const state = previous ?? await stateStore.create('approve', { feature })
  state.mode = 'approve'
  state.phase = 'approved'
  state.feature = feature
  state.completedPhases = [...new Set([...state.completedPhases, 'approve'])]
  await stateStore.save(state)

  const cleanup = await cleanupPrepareSessions({ config, state, log })
  if (cleanup.deleted.length > 0) {
    state.sessions = (state.sessions ?? []).filter(session => !cleanup.deleted.some(deleted => sameSession(deleted, session)))
    await stateStore.save(state)
  }

  await log?.(`Tickets generated at ${readyDir}.`)
  return {
    feature,
    readyDir,
    sessionsDeleted: cleanup.deleted.map(session => session.title),
    sessionsRetained: cleanup.retained
  }
}

export async function cleanupPrepareSessions({ config, state, log, removeSession = deleteSession }) {
  const sessions = prepareSessionsToDelete(state)
  const deleted = []
  for (const session of sessions) {
    try {
      const result = await removeSession({ config, session })
      if (result.deleted) {
        deleted.push(session)
        await log?.(`Deleted retained session ${session.title}.`)
      } else {
        await log?.(`Retained session ${session.title}: ${result.reason}.`)
      }
    } catch (error) {
      await log?.(`Could not delete retained session ${session.title}: ${error.message}`)
    }
  }
  return { deleted, retained: sessions.length - deleted.length }
}

function sameSession(left, right) {
  if (left.id && right.id) return left.id === right.id
  return Boolean(left.title && right.title && left.title === right.title)
}

export async function runDev({ config, stateStore, options, log }) {
  const loaded = await stateStore.load()
  const feature = await resolveFeature({ config, options, state: loaded, dirs: [config.ticketDirs.readyForDev] })
  const readyDir = path.join(config.repoPath, config.ticketDirs.readyForDev, feature)
  const doneDir = path.join(config.repoPath, config.ticketDirs.done, feature)
  const doneRoot = path.join(config.repoPath, config.ticketDirs.done)
  const tickets = orderTickets(await listTickets(readyDir), { completed: await listTickets(doneRoot) })
  if (tickets.length === 0) throw new Error(`No ready-for-dev tickets found in ${readyDir}.`)

  const state = loaded ?? await stateStore.create('dev', { feature })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()
  const archivedBlockers = await archiveBlockers({ blockers: state.blockers, artifactsDir: artifacts.dir })
  if (archivedBlockers.length > 0) await log?.(`Archived ${archivedBlockers.length} resolved blocker(s).`)
  state.mode = 'dev'
  state.feature = feature
  state.phase = 'dev'
  state.failures = []
  state.blockers = []
  await stateStore.save(state)

  const result = await runTicketQueue({
    config,
    stateStore,
    options,
    log,
    state,
    artifacts,
    feature,
    tickets,
    mode: 'dev',
    branchType: ticket => ticket.type,
    doneDirFor: () => doneDir,
    instructions: 'Implement only this ticket. Do not push or merge. Commit with type: subject, no scope, no ticket or ADR references.'
  })

  let qaFile = null
  if (result.failures.length === 0) {
    qaFile = await collectManualVerification({
      doneDir,
      outputFile: path.join(config.repoPath, config.ticketDirs.qa, `${feature}.md`)
    })
    if (qaFile) await log?.(`Manual verification checklist at ${qaFile}.`)
  }
  return { feature, tickets: result.tickets, failures: result.failures, manualVerification: qaFile }
}

export async function runRefactor({ config, stateStore, options, log }) {
  const loaded = await stateStore.load()
  const requested = String(options.feature ?? '').trim() || null
  const queueDir = path.join(config.repoPath, config.ticketDirs.readyForRefactor)
  const doneRoot = path.join(config.repoPath, config.ticketDirs.done)
  const explicit = options.classification !== undefined || options.priority !== undefined
  const filters = explicit
    ? normalizeFilters(options)
    : (options.resume === true ? normalizeFilters(loaded?.filters ?? {}) : { classifications: [], priorities: [] })
  const queue = await listTickets(queueDir)
  const done = await listTickets(doneRoot)
  const candidates = filterTickets(filterTicketsByFeature(queue, requested), filters)

  if (candidates.length === 0) {
    if (!hasFilters(filters)) {
      const suffix = requested ? ` for feature ${requested}` : ''
      throw new Error(`No ready-for-refactor tickets found in ${queueDir}${suffix}.`)
    }
    const state = loaded ?? await stateStore.create('refactor', { feature: requested, filters })
    state.mode = 'refactor'
    state.feature = requested ?? state.feature ?? null
    state.phase = 'refactor-complete'
    state.filters = filters
    state.failures = []
    state.blockers = []
    await stateStore.save(state)
    const suffix = requested ? ` for feature ${requested}` : ''
    const message = `No ready-for-refactor tickets match ${describeFilters(filters)}${suffix}.`
    await log?.(message)
    return { feature: state.feature, tickets: [], failures: [], filters, message }
  }

  const tickets = selectTickets({ allTickets: queue, tickets: candidates, completed: done })
  const state = loaded ?? await stateStore.create('refactor', { feature: requested, filters })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()
  const archivedBlockers = await archiveBlockers({ blockers: state.blockers, artifactsDir: artifacts.dir })
  if (archivedBlockers.length > 0) await log?.(`Archived ${archivedBlockers.length} resolved blocker(s).`)
  state.mode = 'refactor'
  state.feature = requested ?? state.feature ?? null
  state.filters = filters
  state.phase = 'refactor'
  state.failures = []
  state.blockers = []
  await stateStore.save(state)

  const result = await runTicketQueue({
    config,
    stateStore,
    options,
    log,
    state,
    artifacts,
    feature: state.feature,
    tickets,
    mode: 'refactor',
    branchType: () => 'refactor',
    doneDirFor: ticket => ticketDoneDir(config, ticket, state.feature),
    instructions: 'Refactor only the files in the ticket scope. Preserve the user-visible behavior. Keep tests green. Do not push or merge.'
  })
  return { feature: state.feature, tickets: result.tickets, failures: result.failures, filters }
}

async function runTicketQueue({ config, stateStore, options, log, state, artifacts, feature, tickets, mode, branchType, doneDirFor, instructions }) {
  const results = []
  const failures = []
  const failedIds = new Set()
  const blockedIds = new Set()

  for (const ticket of tickets) {
    const blocked = blockedDependents(tickets, [...failedIds, ...blockedIds])
    if (blocked.has(ticket.id)) {
      const blockedBy = ticket.dependsOn.filter(dependency => failedIds.has(dependency) || blockedIds.has(dependency))
      const failure = { ticket: ticket.id, slug: ticket.slug, branch: null, stage: 'blocked', blockedBy, error: `A dependency failed: ${blockedBy.join(', ')}.` }
      blockedIds.add(ticket.id)
      failures.push(failure)
      state.failures = failures
      await stateStore.save(state)
      await log?.(`Skipped ${ticket.id}: a dependency failed.`)
      continue
    }

    let branch = null
    let stage = 'branch'
    try {
      await git.fetch(config.repoPath)
      const resolved = await resolveTicketBranch({ config, ticket, type: branchType(ticket) })
      branch = resolved.branch
      if (resolved.reuse) {
        const switched = await git.switchBranchSafe(config.repoPath, branch)
        if (!switched) throw new Error(`Could not switch to the existing ticket branch ${branch}.`)
        await log?.(`Reusing branch ${branch} for ${ticket.id}.`)
      } else {
        await git.createBranchFrom(config.repoPath, branch, config.baseBranch)
        await log?.(`Ticket ${ticket.id}: branch ${branch}.`)
      }

      const payload = {
        mode,
        ticketId: ticket.id,
        ticketFile: ticket.file,
        title: ticket.title,
        type: ticket.type,
        priority: ticket.priority,
        branch,
        baseBranch: config.baseBranch,
        restoreCommand: config.restoreCommand,
        buildCommand: config.buildCommand,
        testCommand: config.testCommand,
        smokeCommand: config.smokeCommand,
        stateDir: config.stateDir,
        instructions
      }

      if (!resolved.reuse) {
        stage = 'executor'
        const execution = await runSession({
          config,
          prompt: 'autopai-dev',
          agent: config.agents.executor,
          payload,
          title: `AutopAI ${mode} ${ticket.id}`,
          logFile: artifacts.path(`${mode === 'refactor' ? 'refactor' : 'executor'}-${ticket.slug}.log`),
          role: 'executor'
        })
        const blockers = await listBlockers(config)
        if (blockers.length > 0) {
          state.blockers = blockers.map(blocker => blocker.file)
          await stateStore.save(state)
          throw new Error(blockerMessage(blockers))
        }
        if (execution.code !== 0) throw new Error(`Executor failed for ${mode} ticket ${ticket.id}.`)
      }

      stage = 'commits'
      const range = `origin/${config.baseBranch}...${branch}`
      let commits = await git.logCommits(config.repoPath, range)
      if (commits.length === 0) throw new Error(`Ticket ${ticket.id} produced no commits on ${branch}.`)

      stage = 'gates'
      let gates = await runGates({ config, artifacts, prefix: `${mode}-${ticket.slug}`, retries: config.localGateRetries })
      if (!gates.ok && options.fix === true) {
        await log?.(`Local gates failed for ${ticket.id}; running the fix attempt.`)
        gates = await fixLocalGates({ config, stateStore, state, artifacts, ticket, branch, payload, gates, mode })
      }
      if (!gates.ok) throw new Error(`Ticket ${ticket.id} failed local gates: ${gateFailureText(gates)}`)

      stage = 'policy'
      commits = await git.logCommits(config.repoPath, range)
      if (commits.length === 0) throw new Error(`Ticket ${ticket.id} produced no commits on ${branch}.`)
      const violations = scanBranch({ branch, commits, diff: await git.diff(config.repoPath, range) })
      if (violations.length > 0) throw new Error(`Ticket ${ticket.id} violates policy:\n${formatViolations(violations)}`)

      stage = 'merge'
      const changedFiles = await git.diffNames(config.repoPath, range)
      const title = ticketTitle(ticket)
      const merge = await pushOpenWaitMerge({
        config,
        artifacts,
        branch,
        baseBranch: config.baseBranch,
        title,
        prBody: generatePrBody({ commits, coverage: gates.coverage }),
        state,
        stateStore,
        executorPrompt: 'autopai-dev',
        executorPayload: payload,
        coverage: gates.coverage,
        log
      })

      await moveTicket(ticket, doneDirFor(ticket))
      state.scopes.push({ name: ticket.slug, branch, ticket: ticket.id, changedFiles, prNumber: merge.prNumber, mergeCommit: merge.mergeCommit })
      state.completedPhases = [...new Set([...state.completedPhases, `${mode}:${ticket.id}`])]
      await stateStore.save(state)
      results.push({ ticket: ticket.id, branch, prNumber: merge.prNumber, title })
    } catch (error) {
      const failedStage = (state.blockers ?? []).length > 0 ? 'blocker' : stage
      const failure = { ticket: ticket.id, slug: ticket.slug, branch, stage: failedStage, error: error.message }
      failures.push(failure)
      failedIds.add(ticket.id)
      state.failures = failures
      await stateStore.save(state)
      await log?.(`Ticket ${ticket.id} failed at ${failedStage}: ${error.message}`)
      if (failedStage === 'blocker' || config.continueOnFailure !== true) throw error
    }
  }

  state.phase = failures.length === 0 ? `${mode}-complete` : mode
  state.failures = failures
  await stateStore.save(state)
  return { feature, tickets: results, failures }
}

async function fixLocalGates({ config, stateStore, state, artifacts, ticket, branch, payload, gates, mode }) {
  const range = `origin/${config.baseBranch}...${branch}`
  const patchPath = await artifacts.write(`ticket-${slugify(ticket.slug)}.patch`, await git.diff(config.repoPath, range))
  const changedFiles = await git.diffNames(config.repoPath, range)
  const execution = await runSession({
    config,
    prompt: 'autopai-finish',
    agent: config.agents.executor,
    payload: {
      ...payload,
      mode: 'finish',
      patchPath,
      changedFiles,
      gateFailure: gateFailureText(gates),
      instructions: 'Fix only the local gate failure on this ticket branch. Keep the ticket scope. Do not push or merge.'
    },
    title: `AutopAI fix ${ticket.id} local gates`,
    logFile: artifacts.path(`executor-gate-fix-${ticket.slug}.log`),
    role: 'executor'
  })
  const blockers = await listBlockers(config)
  if (blockers.length > 0) {
    state.blockers = blockers.map(blocker => blocker.file)
    await stateStore.save(state)
    throw new Error(blockerMessage(blockers))
  }
  if (execution.code !== 0) throw new Error(`Executor failed while fixing local gates for ticket ${ticket.id}.`)
  return runGates({ config, artifacts, prefix: `fix-${mode}-${ticket.slug}`, retries: 0 })
}

/**
 * Turns the Identified findings of the last audit into ready-for-refactor
 * tickets. The planner owns the promotion; the auditor stays read-only.
 */
export async function runPromote({ config, stateStore, options, log }) {
  const state = (await stateStore.load()) ?? await stateStore.create('promote', {})
  const feature = String(options.feature ?? state.feature ?? 'tech-debt').trim() || 'tech-debt'
  const explicit = options.classification !== undefined || options.priority !== undefined
  const audited = state.mode === 'identify' || state.mode === 'promote'
  const filters = explicit
    ? normalizeFilters(options)
    : normalizeFilters(audited ? state.filters ?? {} : {})
  state.filters = filters
  const groups = await resolveFindingGroups({ config, state })
  const filteredGroups = []
  for (const group of groups) {
    const findings = await filterFindingFiles(group.findings, filters)
    if (findings.length > 0) filteredGroups.push({ ...group, findings })
  }
  if (groups.length === 0 || filteredGroups.length === 0) {
    if (!hasFilters(filters)) throw new Error('No Identified tickets were found. Run identify first.')
    state.mode = 'promote'
    state.phase = 'promoted'
    state.feature = feature
    state.completedPhases = [...new Set([...state.completedPhases, 'promote'])]
    await stateStore.save(state)
    const message = `No Identified findings match ${describeFilters(filters)}.`
    await log?.(message)
    const outputDir = path.join(config.repoPath, config.ticketDirs.readyForRefactor)
    return { feature, outputDir, chunks: [], tickets: 0, filters, message }
  }

  const pending = selectPromotionGroups(filteredGroups, { chunk: options.chunk, completedPhases: state.completedPhases })
  const outputDir = path.join(config.repoPath, config.ticketDirs.readyForRefactor)
  await ensureDir(outputDir)
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()

  state.mode = 'promote'
  state.phase = 'promoting'
  state.feature = feature
  await stateStore.save(state)

  const sessions = []
  for (const group of pending) {
    const execution = await runSession({
      config,
      prompt: 'ready-for-refactor',
      agent: config.agents.planner,
      payload: { feature, findings: group.findings, outputDir, chunk: group.name },
      title: `AutopAI promote ${feature} ${group.name}`,
      logFile: artifacts.path(`planner-ready-for-refactor-${slugify(group.name)}.log`),
      role: 'planner'
    })
    if (execution.code !== 0) throw new Error(`The planner could not generate ready-for-refactor tickets for ${group.name}.`)
    state.completedPhases = [...new Set([...state.completedPhases, `promote:${group.name}`])]
    await stateStore.save(state)
    sessions.push({ chunk: group.name, findings: group.findings.length })
    await log?.(`Promoted ${group.findings.length} findings from ${group.name}.`)
  }

  const tickets = await listMarkdown(outputDir)
  state.phase = 'promoted'
  state.completedPhases = [...new Set([...state.completedPhases, 'promote'])]
  await stateStore.save(state)
  if (pending.length === 0) await log?.('Every promotion chunk was already completed.')
  await log?.(`Ready-for-refactor tickets at ${outputDir}.`)
  return { feature, outputDir, chunks: sessions, tickets: tickets.length, filters }
}

export async function runRelease({ config, stateStore, options, log }) {
  const version = String(options.version ?? '').trim()
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('A semantic --version in MAJOR.MINOR.PATCH format is required.')

  const branch = `chore/release-v${version}`
  await git.fetch(config.repoPath)
  await git.createBranchFrom(config.repoPath, branch, config.baseBranch)

  const state = (await stateStore.load()) ?? await stateStore.create('release', { branch })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()

  const execution = await runSession({
    config,
    prompt: 'release',
    agent: config.agents.executor,
    payload: {
      mode: 'release',
      version,
      branch,
      baseBranch: config.baseBranch,
      releaseBranch: config.releaseBranch,
      restoreCommand: config.restoreCommand,
      buildCommand: config.buildCommand,
      testCommand: config.testCommand,
      stateDir: config.stateDir
    },
    title: `AutopAI release v${version}`,
    logFile: artifacts.path(`release-v${version}.log`),
    role: 'executor'
  })
  if (execution.code !== 0) throw new Error('The executor could not prepare the release.')

  const range = `origin/${config.baseBranch}...${branch}`
  const commits = await git.logCommits(config.repoPath, range)
  const gates = await runGates({ config, artifacts, prefix: `release-v${version}`, retries: config.localGateRetries })
  if (!gates.ok) throw new Error(`Release gates failed: ${gateFailureText(gates)}`)
  const title = `chore: release v${version}`

  const merge = await pushOpenWaitMerge({
    config,
    artifacts,
    branch,
    baseBranch: config.releaseBranch,
    title,
    prBody: generatePrBody({ commits, coverage: gates.coverage }),
    state,
    stateStore,
    executorPrompt: 'release',
    executorPayload: { mode: 'release', version, baseBranch: config.baseBranch, releaseBranch: config.releaseBranch, stateDir: config.stateDir },
    coverage: gates.coverage,
    log
  })

  const tag = `v${version}`
  await git.tag(config.repoPath, tag, merge.mergeCommit)
  await git.pushTag(config.repoPath, tag)

  state.phase = 'released'
  state.completedPhases = [...new Set([...state.completedPhases, 'release'])]
  await stateStore.save(state)
  return { version, tag, prNumber: merge.prNumber, mergeCommit: merge.mergeCommit }
}

function resolvePrepareFeature(options) {
  const explicit = String(options.feature ?? '').trim()
  if (explicit) return explicit
  const derived = featureFromDescription(options.description)
  if (derived) return derived
  throw new Error('The --feature option is required when no --description is provided.')
}

async function resolveFindingGroups({ config, state }) {
  const recorded = stateFindingGroups(state)
  if (recorded !== null) return recorded.filter(group => group.findings.length > 0)

  const files = await listMarkdown(path.join(config.repoPath, config.ticketDirs.identified))
  const byScope = new Map()
  for (const file of files) {
    const name = path.basename(path.dirname(file)) || 'identified'
    if (!byScope.has(name)) byScope.set(name, [])
    byScope.get(name).push(file)
  }
  return [...byScope.entries()].map(([name, findings]) => ({ name, findings }))
}

async function listMarkdown(dir) {
  const { walkFiles } = await import('../lib/util.js')
  return walkFiles(dir, file => file.endsWith('.md'))
}

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}
