import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from '../lib/git.js'
import { runSession } from '../lib/session.js'
import { scanBranch, formatViolations } from '../lib/policy.js'
import { runGates, gateFailureText } from '../lib/gates.js'
import { generatePrBody, resolveTitle } from '../lib/title.js'
import { pushOpenWaitMerge } from '../lib/pr.js'
import { Artifacts } from '../lib/artifacts.js'
import { branchNameFor, listTickets, moveTicket, orderTickets } from '../lib/tickets.js'
import { ensureDir } from '../lib/util.js'

export async function runPrepare({ config, stateStore, options, log }) {
  const feature = requireFeature(options)
  const backlogDir = path.join(config.repoPath, config.ticketDirs.backlog, feature)
  const briefPath = path.join(backlogDir, 'brief.md')
  await ensureDir(backlogDir)

  const state = await stateStore.create('prepare', { feature, phase: 'backlog' })
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
      title: `autopilot brief ${feature}`,
      logFile: artifacts.path('planner-brief.log'),
      role: 'planner'
    })
    if (briefRun.code !== 0) throw new Error('The planner could not write the feature brief.')
  }

  const backlogRun = await runSession({
    config,
    prompt: 'backlog',
    agent: config.agents.planner,
    payload: { feature, briefPath, outputDir: backlogDir },
    title: `autopilot backlog ${feature}`,
    logFile: artifacts.path('planner-backlog.log'),
    role: 'planner'
  })
  if (backlogRun.code !== 0) throw new Error('The planner could not generate the backlog.')

  state.phase = 'awaiting_approval'
  state.completedPhases = [...new Set([...state.completedPhases, 'prepare', 'backlog'])]
  await stateStore.save(state)

  const backlogFiles = await listMarkdown(backlogDir)
  await log?.(`Backlog ready for review at ${backlogDir}.`)
  return { feature, backlogDir, backlogFiles, phase: 'awaiting_approval' }
}

export async function runApprove({ config, stateStore, options, log }) {
  const feature = requireFeature(options)
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
    title: `autopilot ready-for-dev ${feature}`,
    logFile: artifacts.path('planner-ready-for-dev.log'),
    role: 'planner'
  })
  if (generated.code !== 0) throw new Error('The planner could not generate ready-for-dev tickets.')

  await log?.(`Tickets generated at ${readyDir}.`)
  return runDev({ config, stateStore, options, log })
}

export async function runDev({ config, stateStore, options, log }) {
  const feature = requireFeature(options)
  const readyDir = path.join(config.repoPath, config.ticketDirs.readyForDev, feature)
  const doneDir = path.join(config.repoPath, config.ticketDirs.done, feature)
  const tickets = orderTickets(await listTickets(readyDir))
  if (tickets.length === 0) throw new Error(`No ready-for-dev tickets found in ${readyDir}.`)

  const state = (await stateStore.load()) ?? await stateStore.create('dev', { feature })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()
  state.mode = 'dev'
  state.feature = feature
  state.phase = 'dev'

  const results = []
  for (const ticket of tickets) {
    const branches = await git.listLocalBranches(config.repoPath)
    const branch = branchNameFor(ticket, branches)
    await git.fetch(config.repoPath)
    await git.createBranchFrom(config.repoPath, branch, config.baseBranch)
    await log?.(`Ticket ${ticket.id}: branch ${branch}.`)

    const payload = {
      mode: 'dev',
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
      stateDir: config.stateDir,
      instructions: 'Implement only this ticket. Do not push or merge. Commit with type: subject, no scope, no ticket or ADR references.'
    }

    const execution = await runSession({
      config,
      prompt: 'autopilot-dev',
      agent: config.agents.executor,
      payload,
      title: `autopilot dev ${ticket.id}`,
      logFile: artifacts.path(`executor-${ticket.slug}.log`),
      role: 'executor'
    })
    if (execution.code !== 0) throw new Error(`Executor failed for ticket ${ticket.id}.`)

    const range = `origin/${config.baseBranch}...${branch}`
    const commits = await git.logCommits(config.repoPath, range)
    if (commits.length === 0) throw new Error(`Ticket ${ticket.id} produced no commits on ${branch}.`)

    const violations = scanBranch({ branch, commits, diff: await git.diff(config.repoPath, range) })
    if (violations.length > 0) throw new Error(`Ticket ${ticket.id} violates policy:\n${formatViolations(violations)}`)

    const gates = await runGates({ config, artifacts, prefix: ticket.slug })
    if (!gates.ok) throw new Error(`Ticket ${ticket.id} failed local gates: ${gateFailureText(gates)}`)

    const title = await resolveTitle({ config, branch, commits })
    const prBody = generatePrBody({ commits, coverage: gates.coverage })
    const merge = await pushOpenWaitMerge({
      config,
      artifacts,
      branch,
      baseBranch: config.baseBranch,
      title,
      prBody,
      state,
      executorPrompt: 'autopilot-dev',
      executorPayload: payload,
      coverage: gates.coverage,
      log
    })

    await moveTicket(ticket, doneDir)
    state.scopes.push({ name: ticket.slug, branch, ticket: ticket.id, changedFiles: await git.diffNames(config.repoPath, range), prNumber: merge.prNumber, mergeCommit: merge.mergeCommit })
    state.completedPhases = [...new Set([...state.completedPhases, `dev:${ticket.id}`])]
    await stateStore.save(state)
    results.push({ ticket: ticket.id, branch, prNumber: merge.prNumber, title })
  }

  state.phase = 'dev-complete'
  await stateStore.save(state)
  return { feature, tickets: results }
}

export async function runRefactor({ config, stateStore, options, log }) {
  const feature = requireFeature(options)
  const readyDir = path.join(config.repoPath, config.ticketDirs.readyForRefactor, feature)
  const doneDir = path.join(config.repoPath, config.ticketDirs.done, feature)
  const tickets = orderTickets(await listTickets(readyDir))
  if (tickets.length === 0) throw new Error(`No ready-for-refactor tickets found in ${readyDir}.`)

  const state = (await stateStore.load()) ?? await stateStore.create('refactor', { feature })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()
  state.mode = 'refactor'
  state.feature = feature
  state.phase = 'refactor'

  const results = []
  for (const ticket of tickets) {
    const branches = await git.listLocalBranches(config.repoPath)
    const branch = branchNameFor({ ...ticket, type: 'refactor' }, branches)
    await git.fetch(config.repoPath)
    await git.createBranchFrom(config.repoPath, branch, config.baseBranch)

    const payload = {
      mode: 'refactor',
      ticketId: ticket.id,
      ticketFile: ticket.file,
      title: ticket.title,
      priority: ticket.priority,
      branch,
      baseBranch: config.baseBranch,
      restoreCommand: config.restoreCommand,
      buildCommand: config.buildCommand,
      testCommand: config.testCommand,
      stateDir: config.stateDir,
      instructions: 'Refactor only the files in the ticket scope. Keep tests green. Do not push or merge.'
    }

    const execution = await runSession({
      config,
      prompt: 'autopilot-dev',
      agent: config.agents.executor,
      payload,
      title: `autopilot refactor ${ticket.id}`,
      logFile: artifacts.path(`refactor-${ticket.slug}.log`),
      role: 'executor'
    })
    if (execution.code !== 0) throw new Error(`Executor failed for refactor ticket ${ticket.id}.`)

    const range = `origin/${config.baseBranch}...${branch}`
    const commits = await git.logCommits(config.repoPath, range)
    const gates = await runGates({ config, artifacts, prefix: `refactor-${ticket.slug}` })
    if (!gates.ok) throw new Error(`Refactor ticket ${ticket.id} failed local gates: ${gateFailureText(gates)}`)

    const title = await resolveTitle({ config, branch, commits })
    const merge = await pushOpenWaitMerge({
      config,
      artifacts,
      branch,
      baseBranch: config.baseBranch,
      title,
      prBody: generatePrBody({ commits, coverage: gates.coverage }),
      state,
      executorPrompt: 'autopilot-dev',
      executorPayload: payload,
      coverage: gates.coverage,
      log
    })

    await moveTicket(ticket, doneDir)
    state.scopes.push({ name: ticket.slug, branch, ticket: ticket.id, prNumber: merge.prNumber, mergeCommit: merge.mergeCommit })
    await stateStore.save(state)
    results.push({ ticket: ticket.id, branch, prNumber: merge.prNumber, title })
  }

  state.phase = 'refactor-complete'
  await stateStore.save(state)
  return { feature, tickets: results }
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
    title: `autopilot release v${version}`,
    logFile: artifacts.path(`release-v${version}.log`),
    role: 'executor'
  })
  if (execution.code !== 0) throw new Error('The executor could not prepare the release.')

  const range = `origin/${config.baseBranch}...${branch}`
  const commits = await git.logCommits(config.repoPath, range)
  const gates = await runGates({ config, artifacts, prefix: `release-v${version}` })
  if (!gates.ok) throw new Error(`Release gates failed: ${gateFailureText(gates)}`)
  const title = await resolveTitle({ config, branch, commits })

  const merge = await pushOpenWaitMerge({
    config,
    artifacts,
    branch,
    baseBranch: config.releaseBranch,
    title,
    prBody: generatePrBody({ commits, coverage: gates.coverage }),
    state,
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

function requireFeature(options) {
  const feature = String(options.feature ?? '').trim()
  if (!feature) throw new Error('The --feature option is required.')
  return feature
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
