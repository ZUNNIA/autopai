#!/usr/bin/env node
import path from 'node:path'
import { parseCliArgs } from './lib/util.js'
import { loadConfig } from './lib/config.js'
import { auditConfig, formatConfigReport } from './lib/config-audit.js'
import { StateStore } from './lib/state.js'
import { runAdopt } from './phases/adopt.js'
import { runIdentify } from './phases/identify.js'
import { runApprove, runDev, runPrepare, runPromote, runRefactor, runRelease } from './phases/pipeline.js'
import { Artifacts } from './lib/artifacts.js'
import { continueSession } from './lib/session.js'
import { nextPhase } from './lib/resume.js'
import { hasFilters, normalizeFilters } from './lib/filters.js'
import { currentGate, gateAfterPhase, gateLabel, normalizeApprovedGate, normalizePauseAfter } from './lib/pauses.js'
import { recoverPrepareReview } from './lib/prepare-review.js'

const PHASES = ['prepare', 'approve', 'dev', 'identify', 'promote', 'refactor', 'release', 'adopt']

async function main() {
  const { command, options } = parseCliArgs(process.argv.slice(2))
  const repoPath = path.resolve(String(options.repo ?? process.cwd()))
  const log = message => process.stdout.write(`${message}\n`)

  if (command === 'help' || options.help) return printHelp()
  if (command === 'config') return runConfigCommand(repoPath, options)

  const config = await loadConfig(repoPath)
  const stateStore = new StateStore(config)

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
    else if (command === 'identify') result = await runIdentify(ctx)
    else if (command === 'promote') result = await runPromote(ctx)
    else if (command === 'prepare') result = await runPrepare(ctx)
    else if (command === 'approve') result = await runApprove(ctx)
    else if (command === 'dev') result = await runDev(ctx)
    else if (command === 'refactor') result = await runRefactor(ctx)
    else if (command === 'release') result = await runRelease(ctx)
    else if (command === 'run') result = await runSequence(ctx)
    else if (command === 'revise') result = await runRevise(ctx)
    else throw new Error(`Unknown command: ${command}`)
    printResult(result)
    return result
  } finally {
    await stateStore.unlock()
  }
}

async function runRevise({ config, stateStore, options, log }) {
  const message = String(options.message ?? '').trim()
  if (!message || message === 'true') throw new Error('Usage: autopai revise --repo <path> --message <change>')

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
      log(`${result.failures.length} ticket(s) failed in ${phase}. Fix them with autopai resume --fix or retry with autopai resume.`)
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
  }

  const effectivePause = approved ? pauseAfter.filter(gate => gate !== approved) : pauseAfter
  let next = nextPhase(state, effectivePause)
  if (next.action === 'none') {
    process.stdout.write(`${next.reason}\n`)
    return
  }

  await stateStore.lock()
  try {
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
        process.stdout.write(`Paused with ${result.failures.length} failed ticket(s). Run autopai resume --fix to fix them or autopai resume to retry.\n`)
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

async function runConfigCommand(repoPath, options) {
  const action = String((options._ ?? [])[0] ?? 'check')
  if (action !== 'check') throw new Error('Usage: autopai config check --repo <path> [--json] [--strict]')

  const report = await auditConfig(repoPath)
  if (options.json === true) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else process.stdout.write(`${formatConfigReport(report)}\n`)

  const strict = options.strict === true
  if (!report.ok || (strict && (report.warnings.length > 0 || report.missing.length > 0))) process.exitCode = 1
  return report
}

function printStatus(state, config) {
  if (!state) {
    process.stdout.write('No AutopAI state found for this repository.\n')
    return
  }
  const gate = currentGate(state)
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
    filters: normalizeFilters(state.filters ?? {}),
    sessions: (state.sessions ?? []).map(session => ({
      kind: session.kind,
      title: session.title,
      id: session.id ?? null
    })),
    gate,
    paused: gate ? config.pauseAfter.includes(gate) : false,
    pauseAfter: config.pauseAfter
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

function printHelp() {
  process.stdout.write(`autopai

Usage:
  autopai adopt --repo <path> [--branch <name>] [--base <branch>] [--title <title>] [--dry-run]
  autopai identify --repo <path> [--last <n>] [--scope branch:<name>] [--scope pr:<number>] [--scope dir:<path>] [--classification <list>] [--priority <list>] [--dry-run]
  autopai promote --repo <path> [--feature <slug>] [--chunk <name>] [--classification <list>] [--priority <list>]
  autopai prepare --repo <path> [--feature <slug>] [--description <text>]
  autopai approve --repo <path> [--feature <slug>]
  autopai dev --repo <path> [--feature <slug>]
  autopai refactor --repo <path> [--feature <slug>] [--classification <list>] [--priority <list>]
  autopai release --repo <path> --version <x.y.z>
  autopai revise --repo <path> --message <change>
  autopai run --repo <path> --from <phase> --to <phase> [--auto] [--pause-after <gates>] [--fix] [--classification <list>] [--priority <list>] [phase options]
  autopai status --repo <path>
  autopai config check --repo <path> [--json] [--strict]
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

revise continues the retained backlog session with a review message. It never
loads the original prompt, creates a new session, or approves the backlog.

Human gates pause the assisted loop after prepare, approve, dev, identify,
promote, or refactor. pauseAfter defaults to backlog, plan, and qa. resume at a
gate does not approve it: pass --approve <gate> only when you accept that exact
gate, or --auto to skip every human pause. --pause-after overrides the list for
one run. Gates: backlog, plan, qa, findings, promotion, refactor.

Local gate failures are retried once by default. --fix adds one executor fix
attempt for a failed ticket before recording the failure.

autopai config check audits autopai.json against the schema without writing:
it reports missing defaults, unknown or deprecated fields, invalid types, paths,
and legacy agent names. It exits 1 on errors; --strict also fails on warnings and
missing defaults. --json prints the report for /autopai-init.
`)
}

main().catch(error => {
  process.stderr.write(`autopai: ${error.message}\n`)
  process.exitCode = 1
})
