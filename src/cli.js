#!/usr/bin/env node
import path from 'node:path'
import { parseCliArgs } from './lib/util.js'
import { loadConfig } from './lib/config.js'
import { StateStore } from './lib/state.js'
import { runAdopt } from './phases/adopt.js'
import { runIdentify } from './phases/identify.js'
import { runApprove, runDev, runPrepare, runPromote, runRefactor, runRelease } from './phases/pipeline.js'

const PHASES = ['prepare', 'approve', 'dev', 'identify', 'promote', 'refactor', 'release', 'adopt']

async function main() {
  const { command, options } = parseCliArgs(process.argv.slice(2))
  const repoPath = path.resolve(String(options.repo ?? process.cwd()))
  const log = message => process.stdout.write(`${message}\n`)

  if (command === 'help' || options.help) return printHelp()

  const config = await loadConfig(repoPath)
  const stateStore = new StateStore(config)

  if (command === 'status') return printStatus(await stateStore.load())
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
    else throw new Error(`Unknown command: ${command}`)
    printResult(result)
    return result
  } finally {
    await stateStore.unlock()
  }
}

async function runSequence({ config, stateStore, options, log }) {
  const from = String(options.from ?? 'prepare')
  const to = String(options.to ?? 'refactor')
  const start = PHASES.indexOf(from)
  const end = PHASES.indexOf(to)
  if (start < 0 || end < 0 || start > end) throw new Error(`Invalid phase range: ${from}..${to}`)

  const results = []
  for (const phase of PHASES.slice(start, end + 1)) {
    if (!['prepare', 'approve', 'dev', 'identify', 'promote', 'refactor', 'release', 'adopt'].includes(phase)) continue
    log(`Running phase ${phase}.`)
    const ctx = { config, stateStore, options, log }
    if (phase === 'prepare') results.push(await runPrepare(ctx))
    if (phase === 'approve') results.push(await runApprove(ctx))
    if (phase === 'dev') results.push(await runDev(ctx))
    if (phase === 'identify') results.push(await runIdentify(ctx))
    if (phase === 'promote') results.push(await runPromote(ctx))
    if (phase === 'refactor') results.push(await runRefactor(ctx))
    if (phase === 'release') results.push(await runRelease(ctx))
    if (phase === 'adopt') results.push(await runAdopt(ctx))
  }
  return { from, to, results }
}

async function resumeRun({ config, stateStore, options, log }) {
  const state = await stateStore.load()
  if (!state) throw new Error('No state found for this repository.')
  log(`Resuming ${state.mode} at phase ${state.phase}.`)
  await stateStore.lock()
  try {
    const ctx = { config, stateStore, options: { ...options, branch: state.branch, base: state.baseBranch, feature: state.feature }, log }
    let result
    if (state.mode === 'adopt') result = await runAdopt(ctx)
    else if (state.mode === 'prepare') result = await runPrepare(ctx)
    else if (state.mode === 'dev') result = await runDev(ctx)
    else if (state.mode === 'refactor') result = await runRefactor(ctx)
    else if (state.mode === 'identify') result = await runIdentify(ctx)
    else if (state.mode === 'promote') result = await runPromote(ctx)
    else throw new Error(`Cannot resume mode ${state.mode} automatically.`)
    printResult(result)
    return result
  } finally {
    await stateStore.unlock()
  }
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

function printStatus(state) {
  if (!state) {
    process.stdout.write('No AutopAI state found for this repository.\n')
    return
  }
  const summary = {
    runId: state.runId,
    mode: state.mode,
    phase: state.phase,
    feature: state.feature,
    branch: state.branch,
    prNumber: state.prNumber,
    mergeCommit: state.mergeCommit,
    scopes: state.scopes?.length ?? 0,
    completedPhases: state.completedPhases
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

function printHelp() {
  process.stdout.write(`autopai

Usage:
  autopai adopt --repo <path> [--branch <name>] [--base <branch>] [--title <title>] [--dry-run]
  autopai identify --repo <path> [--last <n>] [--scope branch:<name>] [--scope pr:<number>] [--scope dir:<path>] [--dry-run]
  autopai promote --repo <path> [--feature <slug>] [--chunk <name>]
  autopai prepare --repo <path> [--feature <slug>] [--description <text>]
  autopai approve --repo <path> [--feature <slug>]
  autopai dev --repo <path> [--feature <slug>]
  autopai refactor --repo <path> [--feature <slug>]
  autopai release --repo <path> --version <x.y.z>
  autopai run --repo <path> --from <phase> --to <phase> [phase options]
  autopai status --repo <path>
  autopai resume --repo <path>
  autopai abort --repo <path>

Phase arguments are optional: the feature resolves from the previous run state
or the latest ticket directory, and identify audits the scopes recorded by the
last run when no --scope is given.
`)
}

main().catch(error => {
  process.stderr.write(`autopai: ${error.message}\n`)
  process.exitCode = 1
})
