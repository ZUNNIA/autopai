#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseCliArgs } from './lib/util.js'
import { readCliDescription, readCliMessage, readCliTextFile } from './lib/cli-message.js'
import { loadConfig } from './lib/config.js'
import { auditConfig, formatConfigReport } from './lib/config-audit.js'
import { reconcileConfig } from './lib/config-reconcile.js'
import * as git from './lib/git.js'
import { StateStore, mergeStateIssues, reconcileMergeState } from './lib/state.js'
import { runAdopt } from './phases/adopt.js'
import { runBranches } from './phases/branches.js'
import { runResolveConflicts } from './phases/conflicts.js'
import { runDiagnostics } from './phases/diagnostics.js'
import { runIdentify } from './phases/identify.js'
import { runApprove, runDev, runPrepare, runPromote, runQaFix, runRefactor, runRelease, runRevisePlan } from './phases/pipeline.js'
import { Artifacts } from './lib/artifacts.js'
import { continueSession } from './lib/session.js'
import { nextPhase } from './lib/resume.js'
import { hasFilters, normalizeFilters } from './lib/filters.js'
import { currentGate, gateAfterPhase, gateLabel, normalizeApprovedGate, normalizePauseAfter } from './lib/pauses.js'
import { recoverPrepareReview } from './lib/prepare-review.js'
import { clearPlanProposal, readPlanProposal, writePlanProposal } from './lib/plan.js'
import { adrStatuses, createAdr } from './lib/adr.js'
import { checkArtifacts } from './lib/artifact-check.js'
import { inspectTickets, readReconcilePlan, reconcileTickets } from './lib/ticket-reconcile.js'
import { syncPlatform } from './lib/platform-sync.js'

const PHASES = ['prepare', 'approve', 'dev', 'identify', 'promote', 'refactor', 'release', 'adopt']

async function main() {
  const { command, options } = parseCliArgs(process.argv.slice(2))
  const repoPath = path.resolve(String(options.repo ?? process.cwd()))
  const log = message => process.stdout.write(`${message}\n`)

  if (command === 'help' || command === '--help' || command === '-h' || options.help) return printHelp()
  if (command === '--version' || command === '-v') {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
    process.stdout.write(`${pkg.version}\n`)
    return
  }
  if (command === 'adr') return runAdrCommand(repoPath, options)
  if (command === 'config') return runConfigCommand(repoPath, options)
  if (command === 'platform') return runPlatformCommand(options)

  const config = await loadConfig(repoPath)
  const stateStore = new StateStore(config)

  if (command !== 'plan' && options.descriptionFile !== undefined) {
    options.description = await readCliDescription(
      options,
      'Usage: autopai prepare --repo <path> [--feature <slug>] [--description <text>|--description-file <path>]'
    )
    delete options.descriptionFile
  }

  if (command === 'plan') return runPlanCommand({ config, stateStore, options, log })
  if (command === 'tickets') return runTicketsCommand({ config, stateStore, options, log })

  if (command === 'artifacts') {
    const action = String((options._ ?? [])[0] ?? '')
    if (action !== 'check') throw new Error('Usage: autopai artifacts check --repo <path> [--json]')
    const report = await checkArtifacts(config)
    if (options.json === true) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    else {
      for (const check of report.checks) {
        if (check.ok) process.stdout.write(`OK ${check.kind} ${check.file}\n`)
        else process.stdout.write(`ERROR ${check.kind} ${check.file}: ${check.errors.join(' ')}\n`)
      }
      process.stdout.write(report.ok ? 'Result: ok\n' : 'Result: failed\n')
    }
    if (!report.ok) process.exitCode = 1
    return report
  }

  if (command === 'status') {
    if (!await stateStore.isActiveRun()) await recoverPrepareReview({ config, stateStore })
    return printStatus(await stateStore.load(), config)
  }
  if (command === 'abort') return abortRun(stateStore)
  if (command === 'resume') return resumeRun({ config, stateStore, options, log })

  await stateStore.lock()
  try {
    const ctx = { config, stateStore, options, log }
    let result
    if (command === 'adopt') result = await runAdopt(ctx)
    else if (command === 'branches') result = await runBranches(ctx)
    else if (command === 'identify') result = await runIdentify(ctx)
    else if (command === 'promote') result = await runPromote(ctx)
    else if (command === 'prepare') result = await runPrepare(ctx)
    else if (command === 'approve') result = await runApprove(ctx)
    else if (command === 'dev') result = await runDev(ctx)
    else if (command === 'refactor') result = await runRefactor(ctx)
    else if (command === 'release') result = await runRelease(ctx)
    else if (command === 'run') result = await runSequence(ctx)
    else if (command === 'revise') result = await runRevise(ctx)
    else if (command === 'revise-plan') result = await runRevisePlan(ctx)
    else if (command === 'qa-fix') result = await runQaFix(ctx)
    else if (command === 'resolve-conflicts') result = await runResolveConflicts(ctx)
    else if (command === 'diagnostics') result = await runDiagnostics(ctx)
    else throw new Error(`Unknown command: ${command}`)
    printResult(result)
    return result
  } finally {
    await stateStore.unlock()
  }
}

async function runRevise({ config, stateStore, options, log }) {
  const message = await readCliMessage(options, 'Usage: autopai revise --repo <path> [--message <change>|--message-file <path>]')

  const recovered = await recoverPrepareReview({ config, stateStore, log })
  const state = recovered ?? await stateStore.load()
  if (!state || state.mode !== 'prepare' || state.phase !== 'awaiting_approval') {
    throw new Error('There is no backlog awaiting review. Run prepare first.')
  }

  const session = [...(state.sessions ?? [])].reverse().find(item => item.kind === 'backlog')
  if (!session) throw new Error('No retained backlog session was found. Run status before revising.')

  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()
  const result = await continueSession({
    config,
    session,
    message,
    agent: config.agents.planner,
    logFile: artifacts.path('planner-revision.log')
  })

  return {
    feature: state.feature,
    session: { title: session.title, id: session.id ?? null },
    output: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim() || null,
    code: result.code
  }
}

async function runSequence({ config, stateStore, options, log }) {
  const from = String(options.from ?? 'prepare')
  const to = String(options.to ?? 'refactor')
  const start = PHASES.indexOf(from)
  const end = PHASES.indexOf(to)
  if (start < 0 || end < 0 || start > end) throw new Error(`Invalid phase range: ${from}..${to}`)

  const pauseAfter = resolvePauseAfter(config, options)
  const phases = PHASES.slice(start, end + 1)
  const results = []
  for (const [index, phase] of phases.entries()) {
    log(`Running phase ${phase}.`)
    const result = await runPhase(phase, { config, stateStore, options, log })
    results.push(result)
    if (result.failures?.length > 0) {
      log(`${result.failures.length} ticket(s) failed in ${phase}. ${failureGuidance(result.failures)}`)
      return { from, to, results, failures: result.failures, failedPhase: phase }
    }
    const gate = gateAfterPhase(phase)
    if (gate && pauseAfter.includes(gate) && index < phases.length - 1) {
      const next = phases[index + 1]
      log(`Paused at the ${gateLabel(gate)} gate after ${phase}. Review the artifacts and run autopai resume --approve ${gate}.`)
      return { from, to, results, pausedAt: gate, nextPhase: next }
    }
  }
  return { from, to, results }
}

async function runPhase(phase, ctx) {
  if (phase === 'prepare') return runPrepare(ctx)
  if (phase === 'approve') return runApprove(ctx)
  if (phase === 'dev') return runDev(ctx)
  if (phase === 'identify') return runIdentify(ctx)
  if (phase === 'promote') return runPromote(ctx)
  if (phase === 'refactor') return runRefactor(ctx)
  if (phase === 'release') return runRelease(ctx)
  if (phase === 'adopt') return runAdopt(ctx)
  throw new Error(`Unknown phase: ${phase}`)
}

function resolvePauseAfter(config, options) {
  if (options.auto === true) return []
  if (options.pauseAfter !== undefined) return normalizePauseAfter(options.pauseAfter)
  return config.pauseAfter
}

async function resumeRun({ config, stateStore, options, log }) {
  const pauseAfter = resolvePauseAfter(config, options)
  let state = await stateStore.load()
  if (!state) {
    process.stdout.write('No AutopAI state found for this repository.\n')
    return
  }

  if (!await stateStore.isActiveRun()) {
    state = await recoverPrepareReview({ config, stateStore, log }) ?? state
  }

  const approved = options.approve !== undefined ? normalizeApprovedGate(options.approve) : null
  if (approved) {
    const gate = currentGate(state)
    if (!gate) throw new Error(`The run is not paused at a human gate; cannot approve ${approved}.`)
    if (gate !== approved) throw new Error(`The run is paused at the ${gateLabel(gate)} gate; cannot approve ${approved}.`)
    if (!pauseAfter.includes(gate)) throw new Error(`The run is not paused at the ${gateLabel(gate)} gate; cannot approve ${approved}.`)
  }

  const effectivePause = approved ? pauseAfter.filter(gate => gate !== approved) : pauseAfter

  await stateStore.lock()
  try {
    const reconciled = reconcileMergeState(state)
    if (reconciled.changed) {
      await stateStore.save(state)
      await log?.('Reconciled missing merge metadata from the last merged scope.')
    }
    for (const issue of mergeStateIssues(state)) await log?.(`State warning: ${issue}`)
    let next = nextPhase(state, effectivePause)
    if (next.action === 'none') {
      process.stdout.write(`${next.reason}\n`)
      return
    }
    const results = []
    while (next.action !== 'none') {
      log(describeAction(next))
      const filteredMode = state.mode === 'identify' || state.mode === 'promote' || state.mode === 'refactor'
      const stateFilters = normalizeFilters(filteredMode ? state.filters ?? {} : {})
      const filterArgs = hasFilters(stateFilters)
        ? {
            classification: stateFilters.classifications.join(','),
            priority: stateFilters.priorities.join(',')
          }
        : {}
      const result = await runAction(next, {
        config,
        stateStore,
        log,
        options: {
          ...options,
          ...filterArgs,
          resume: next.action === 'resume',
          branch: state.branch,
          base: state.baseBranch,
          feature: next.feature ?? state.feature
        }
      })
      results.push(result)
      if (result.failures?.length > 0) {
        process.stdout.write(`Paused with ${result.failures.length} failed ticket(s). ${failureGuidance(result.failures)}\n`)
        break
      }
      state = await stateStore.load()
      next = nextPhase(state, effectivePause)
    }
    if (next.reason) process.stdout.write(`${next.reason}\n`)
    printResult(results.length === 1 ? results[0] : { resumed: results })
    return results
  } finally {
    await stateStore.unlock()
  }
}

async function runAction(next, ctx) {
  if (next.action === 'approve') return runApprove(ctx)
  if (next.action === 'dev') return runDev(ctx)
  if (next.action === 'identify') return runIdentify(ctx)
  if (next.action === 'promote') return runPromote(ctx)
  if (next.action === 'refactor') return runRefactor(ctx)
  if (next.action === 'resume') {
    if (next.mode === 'adopt') return runAdopt(ctx)
    if (next.mode === 'prepare') return runPrepare(ctx)
    if (next.mode === 'dev') return runDev(ctx)
    if (next.mode === 'refactor') return runRefactor(ctx)
    if (next.mode === 'identify') return runIdentify(ctx)
    if (next.mode === 'promote') return runPromote(ctx)
  }
  throw new Error(`Cannot continue action ${next.action}.`)
}

function describeAction(next) {
  if (next.action === 'resume') return `Continuing ${next.mode} from the stored phase.`
  return `Continuing with phase ${next.action}.`
}

function printResult(result) {
  if (result === undefined || result === null) return
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

async function abortRun(stateStore) {
  const state = await stateStore.load()
  if (state) {
    state.phase = 'aborted'
    state.updatedAt = new Date().toISOString()
    await stateStore.save(state)
  }
  await stateStore.unlock()
  process.stdout.write('AutopAI run marked as aborted and the lock was released.\n')
}

async function runAdrCommand(repoPath, options) {
  const action = String((options._ ?? [])[0] ?? '')
  const usage = 'Usage: autopai adr new --repo <path> --title <title> [--status Proposed|Accepted|Deprecated|Superseded] [--content-file <path>] [--json]'
  if (action !== 'new') throw new Error(usage)
  const status = String(options.status ?? 'Proposed').trim()
  if (!adrStatuses().includes(status)) throw new Error(`ADR status must be one of: ${adrStatuses().join(', ')}.`)
  const content = options.contentFile !== undefined
    ? await readCliTextFile(options.contentFile, 'content', usage)
    : null
  const result = await createAdr({
    repoPath: path.resolve(repoPath),
    title: String(options.title ?? ''),
    status,
    content
  })
  if (options.json === true) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  else process.stdout.write(`${result.file}\n`)
  return result
}

async function runPlanCommand({ config, stateStore, options, log }) {
  const action = String((options._ ?? [])[0] ?? '')

  if (action === 'propose') {
    const description = await readCliDescription(
      options,
      'Usage: autopai plan propose --repo <path> --feature <slug> --description <text>|--description-file <path>'
    )
    const proposal = await writePlanProposal({
      config,
      feature: options.feature,
      description
    })
    process.stdout.write(`Plan proposal: ${proposal.file}\n`)
    process.stdout.write(`Feature: ${proposal.feature}\n`)
    return proposal
  }

  if (action === 'generate') {
    if (options.confirm !== true) throw new Error('plan generate requires --confirm after the founder approves the proposal.')
    const proposal = await readPlanProposal(config)
    if (!proposal) throw new Error('No plan proposal found. Run plan propose after the discussion.')
    const feature = String(options.feature ?? proposal.feature).trim()
    if (feature !== proposal.feature) {
      throw new Error(`The proposal is for ${proposal.feature}, not ${feature}. Run plan propose for the new feature first.`)
    }

    await stateStore.lock()
    try {
      const result = await runPrepare({
        config,
        stateStore,
        options: { ...options, feature, description: proposal.description },
        log
      })
      await clearPlanProposal(config)
      printResult(result)
      return result
    } finally {
      await stateStore.unlock()
    }
  }

  throw new Error('Usage: autopai plan propose --repo <path> --feature <slug> --description <text> OR autopai plan generate --repo <path> --feature <slug> --confirm')
}

async function runTicketsCommand({ config, stateStore, options, log }) {
  const action = String((options._ ?? [])[0] ?? '')
  if (action === 'inspect') {
    const report = await inspectTickets(config)
    if (options.json === true) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    else printTicketsInspection(report)
    return report
  }

  if (action === 'reconcile') {
    if (options.plan === undefined || options.plan === true) {
      throw new Error('Usage: autopai tickets reconcile --repo <path> --plan <file> [--apply --confirm] [--json]')
    }
    const planFile = path.resolve(String(options.plan))
    const { raw } = await readReconcilePlan(planFile)
    if (await stateStore.isActiveRun()) {
      throw new Error('Another AutopAI run is active. Stop it before reconciling the ticket queue.')
    }
    const apply = options.apply === true
    if (apply && options.confirm !== true) {
      throw new Error('Applying a reconciliation plan requires --confirm.')
    }
    let result
    if (apply) {
      await stateStore.lock()
      try {
        result = await reconcileTickets(config, raw, { apply, confirm: true, planFile })
      } finally {
        await stateStore.unlock()
      }
    } else {
      result = await reconcileTickets(config, raw, { planFile })
    }
    if (options.json === true) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    else printTicketsReconciliation(result)
    if (result.verification?.ok === false) process.exitCode = 1
    return result
  }

  throw new Error('Usage: autopai tickets inspect --repo <path> [--json] OR autopai tickets reconcile --repo <path> --plan <file> [--apply --confirm] [--json]')
}

function printTicketsInspection(report) {
  process.stdout.write(`Ready for refactor: ${report.readyForRefactor.length}\n`)
  process.stdout.write(`Done: ${report.done.length}\n`)
  process.stdout.write(`Identified findings: ${report.identified.length}\n`)
  process.stdout.write(`Active blockers: ${report.blockers.length}\n`)
  process.stdout.write(`Active run: ${report.activeRun}\n`)
  process.stdout.write(`Unresolved dependencies: ${report.unresolvedDependencies.length}\n`)
  for (const issue of report.unresolvedDependencies) {
    process.stdout.write(`  ${issue.file}: ${issue.id} depends on ${issue.dependency}\n`)
  }
  if (report.duplicateIds.length > 0) {
    process.stdout.write('Duplicate ids:\n')
    for (const group of report.duplicateIds) {
      process.stdout.write(`  ${group.key}: ${group.files.join(', ')}\n`)
    }
  }
}

function printTicketsReconciliation(result) {
  process.stdout.write(`Plan operations: ${result.operations.length}\n`)
  process.stdout.write(`Verification: ${result.verification?.ok === false ? 'failed' : 'ok'}\n`)
  for (const operation of result.operations) {
    const target = operation.to ? ` -> ${operation.to}` : ''
    const idempotent = operation.idempotent ? ' (already applied)' : ''
    process.stdout.write(`  ${operation.action ?? operation.kind}: ${operation.file}${target}${idempotent}\n`)
  }
  if (result.applied) {
    process.stdout.write(`Applied: yes\n`)
    process.stdout.write(`Backup: ${result.backupDir}\n`)
    process.stdout.write(`Journal: ${result.journal}\n`)
  } else {
    process.stdout.write('Applied: no (dry run). Add --apply --confirm to write.\n')
  }
}

async function runConfigCommand(repoPath, options) {
  const action = String((options._ ?? [])[0] ?? 'check')

  if (action === 'reconcile') {
    const report = await reconcileConfig(repoPath, { apply: options.apply === true })
    if (options.json === true) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    else {
      process.stdout.write(`Config: ${report.configPath}\n`)
      process.stdout.write(`${report.applied ? 'APPLIED' : 'DRY RUN'}\n`)
      for (const key of report.added) process.stdout.write(`ADDED ${key}\n`)
      for (const key of report.unknown) process.stdout.write(`UNKNOWN ${key}\n`)
      if (!report.applied && report.changed) process.stdout.write('Run with --apply to write the safe defaults.\n')
    }
    return report
  }

  if (action !== 'check') throw new Error('Usage: autopai config check|reconcile --repo <path> [--json] [--strict] [--apply]')

  const report = await auditConfig(repoPath)
  if (options.json === true) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else process.stdout.write(`${formatConfigReport(report)}\n`)

  const strict = options.strict === true
  if (!report.ok || (strict && (report.warnings.length > 0 || report.missing.length > 0))) process.exitCode = 1
  return report
}

async function runPlatformCommand(options) {
  const action = String((options._ ?? [])[0] ?? '')
  if (action !== 'sync') throw new Error('Usage: autopai platform sync [--target <dir>] [--dry-run] [--json]')

  const report = await syncPlatform({
    dryRun: options.dryRun === true,
    ...(typeof options.target === 'string' ? { target: options.target } : {})
  })
  if (options.json === true) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return report
  }

  process.stdout.write(`Platform: ${report.target}\n`)
  process.stdout.write(`${report.dryRun ? 'DRY RUN' : 'UPDATED'}\n`)
  for (const file of report.created) process.stdout.write(`CREATED ${file}\n`)
  for (const file of report.updated) process.stdout.write(`UPDATED ${file}\n`)
  for (const file of report.removed) process.stdout.write(`REMOVED ${file}\n`)
  for (const file of report.backedUp) process.stdout.write(`BACKUP  ${file}\n`)
  for (const warning of report.warnings) process.stdout.write(`WARN    ${warning}\n`)
  process.stdout.write(`Agents: ${report.agents.action} ${report.agents.file}\n`)
  return report
}

function failureGuidance(failures = []) {
  const repairable = failures.filter(failure => failure.repairable === true).length
  const branch = failures.filter(failure => failure.stage === 'branch').length
  const blocked = failures.filter(failure => failure.stage === 'blocked').length
  const conflicts = failures.filter(failure => failure.kind === 'conflict').length
  const lines = ['Run autopai resume to retry.']
  if (repairable > 0) lines.push(`Use autopai resume --fix for ${repairable} repairable gate failure(s).`)
  if (branch > 0) lines.push(`${branch} branch failure(s) require a clean checkout or worktree; --fix does not repair them.`)
  if (conflicts > 0) lines.push(`${conflicts} merge conflict(s) require manual resolution; --fix does not resolve them.`)
  if (blocked > 0) lines.push(`${blocked} ticket(s) are blocked by a dependency; resolve the dependency first.`)
  return lines.join(' ')
}

async function printStatus(state, config) {
  const worktree = await git.inspectWorktree(config.repoPath)
  if (!state) {
    process.stdout.write('No AutopAI state found for this repository.\n')
    process.stdout.write(`${JSON.stringify({ worktree }, null, 2)}\n`)
    return
  }
  const gate = currentGate(state)
  const paused = gate ? config.pauseAfter.includes(gate) : false
  const summary = {
    runId: state.runId,
    mode: state.mode,
    phase: state.phase,
    feature: state.feature,
    branch: state.branch,
    prNumber: state.prNumber,
    mergeCommit: state.mergeCommit,
    scopes: state.scopes?.length ?? 0,
    completedPhases: state.completedPhases,
    failures: state.failures ?? [],
    blockers: state.blockers ?? [],
    filters: normalizeFilters(state.filters ?? {}),
    sessions: (state.sessions ?? []).map(session => ({
      kind: session.kind,
      title: session.title,
      id: session.id ?? null
    })),
    gate,
    paused,
    canApprove: paused,
    pauseAfter: config.pauseAfter,
    worktree,
    stateWarnings: mergeStateIssues(state)
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

function printHelp() {
  process.stdout.write(`autopai

Usage:
  autopai adopt --repo <path> [--branch <name>] [--base <branch>] [--title <title>] [--dry-run]
  autopai branches clean --repo <path> --branch <name> [--branch <name>] [--base <branch>] [--dry-run] --confirm
  autopai identify --repo <path> [--last <n>] [--scope branch:<name>] [--scope pr:<number>] [--scope dir:<path>] [--classification <list>] [--priority <list>] [--dry-run]
  autopai promote --repo <path> [--feature <slug>] [--chunk <name>] [--classification <list>] [--priority <list>]
  autopai prepare --repo <path> [--feature <slug>] [--description <text>|--description-file <path>]
  autopai approve --repo <path> [--feature <slug>]
  autopai dev --repo <path> [--feature <slug>]
  autopai refactor --repo <path> [--feature <slug>] [--classification <list>] [--priority <list>]
  autopai release --repo <path> --version <x.y.z>
  autopai qa-fix --repo <path> --message <failure>
  autopai resolve-conflicts --repo <path> [--pr <number>]
  autopai diagnostics --repo <path> [--severity error,warning,info] [--fix] [--branch <name>]
  autopai revise --repo <path> [--message <change>|--message-file <path>]
  autopai revise-plan --repo <path> [--feature <slug>] [--ticket <id>] [--include-summary] [--review-file <path>] [--message <change>|--message-file <path>]
  autopai run --repo <path> --from <phase> --to <phase> [--auto] [--pause-after <gates>] [--fix] [--classification <list>] [--priority <list>] [phase options]
  autopai status --repo <path>
  autopai plan propose --repo <path> --feature <slug> --description <text>|--description-file <path>
  autopai plan generate --repo <path> --feature <slug> --confirm
  autopai adr new --repo <path> --title <title> [--status <status>] [--content-file <path>] [--json]
  autopai artifacts check --repo <path> [--json]
  autopai tickets inspect --repo <path> [--json]
  autopai tickets reconcile --repo <path> --plan <file> [--apply --confirm] [--json]
  autopai config check --repo <path> [--json] [--strict]
  autopai config reconcile --repo <path> [--apply] [--json]
  autopai platform sync [--target <dir>] [--dry-run] [--json]
  autopai resume --repo <path> [--approve <gate>] [--auto] [--pause-after <gates>] [--fix]
  autopai abort --repo <path>

Phase arguments are optional: prepare, approve, and dev resolve the feature
from the previous run state or the latest ticket directory, and identify audits
the scopes recorded by the last run when no --scope is given. Refactor drains
the ready-for-refactor queue; --feature limits it to that front-matter feature.

Technical debt filters: --classification accepts code-smell,
unnecessary-complexity, lack-of-coverage, outdated-library, architecture, and
missing-documentation. --priority accepts urgent, important, and minor. Both
accept comma-separated or repeated values and combine with AND. They restrict
the identify audit, its promotion, and the pending refactor queue. If a selected
ticket depends on a pending ticket outside the filter, the run stops and lists
the dependency. Filters persist through resume.

approve generates the ready-for-dev tickets and stops; dev implements them.

branches clean updates the local base branch and deletes only branches fully merged into origin/<base>, both locally and on origin. It requires a clean worktree and --confirm; --dry-run previews the plan without changing anything.

revise continues the retained backlog session with a review message. Use --message-file for multi-line changes. It never
loads the original prompt, creates a new session, or approves the backlog.

revise-plan starts a planner session over the current ready-for-dev tickets and
applies a review message in place. Use --message-file for multi-line changes. Use --review-file to pass the structured
plan-review result so the planner edits against the coverage matrix and gap history. With --ticket, only that ticket may change.
With --include-summary, the planner may also reconcile the current feature's
brief and backlog with the Work Order and tickets; that flag requires explicit
founder authorization. It validates the artifacts, stays at the plan gate, and
never approves or starts dev.

qa-fix turns a failed manual QA review into fix tickets for the current feature
and starts dev again. It never approves the qa gate.

resolve-conflicts takes an explicit conflicting pull request, merges the base
into its branch, and runs one executor session to resolve the conflicts without
committing, pushing, or merging. Review the result, run the gates, then commit
and push manually.

diagnostics parses compiler errors, warnings, and optional info messages. With
--fix it creates a dedicated branch, asks one executor to repair the selected
diagnostics, and adopts the branch through the normal gates and pull request
flow.

Human gates pause the assisted loop after prepare, approve, dev, identify,
promote, or refactor. pauseAfter defaults to backlog, plan, and qa. resume at a
gate does not approve it: pass --approve <gate> only when you accept that exact
gate, or --auto to skip every human pause. --pause-after overrides the list for
one run. Gates: backlog, plan, qa, findings, promotion, refactor.

Local gate failures are retried once by default. --fix adds one executor fix
attempt only for repairable gate failures. Branch checkout, blocked dependency,
executor, policy, and merge failures are not repaired by --fix.

autopai plan propose records the agreed feature summary without generating
artifacts. autopai plan generate requires --confirm and an existing proposal,
then runs prepare and clears the proposal. Use --description-file for multi-line
descriptions that a Windows command shim would truncate.

autopai adr new creates the next numbered ADR from the standard template and
selects tickets/adr or docs/adr, whichever directory already exists. With
--content-file, the provided content replaces the template; {{number}},
{{title}}, and {{status}} are resolved before writing, and sections 1 to 5 are
required.

autopai artifacts check validates every local brief, backlog, finding, ticket,
and UX proposal against its structural contract. It never writes.

autopai tickets inspect reads the ready-for-refactor, done, identified and
blocker state and prints a JSON report for a founder-approved reconciliation.
autopai tickets reconcile validates a JSON plan and, with --apply --confirm,
moves delivered duplicates to done, archives superseded pending tickets and
stale findings, repairs depends_on, and archives resolved blockers. It locks the
run, backs up every touched file, writes a journal, and verifies the final queue.
A dry run is the default and writes nothing.

autopai config check audits autopai.json against the schema without writing:
it reports missing defaults, unknown or deprecated fields, invalid types, paths,
and legacy agent names. It exits 1 on errors; --strict also fails on warnings and
missing defaults. --json prints the report for /autopai-init.

autopai config reconcile applies only additive defaults that do not require
repository-specific knowledge. It preserves explicit values, reports unknown
keys, and never invents branches, commands, checks, coverage, or runner settings.
Without --apply it prints the proposed changes and writes nothing.

autopai platform sync refreshes the installed OpenCode commands, agents, and the
managed AGENTS.md block from the linked clone. It overwrites only files recorded
by its manifest or present in platforms/opencode/, backs up every overwrite and
removal, and never touches unrelated files. --target overrides the default
~/.config/opencode directory; --dry-run reports without writing.
`)
}

main().catch(error => {
  process.stderr.write(`autopai: ${error.message}\n`)
  process.exitCode = 1
})
