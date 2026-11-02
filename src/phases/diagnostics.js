import path from 'node:path'
import * as git from '../lib/git.js'
import { Artifacts } from '../lib/artifacts.js'
import { StateStore } from '../lib/state.js'
import { parseSeverities, runBuildDiagnostics } from '../lib/diagnostics.js'
import { runSession } from '../lib/session.js'
import { listBlockers, blockerMessage } from '../lib/blockers.js'
import { runAdopt } from './adopt.js'

/**
 * Audits the build for compiler diagnostics. With --fix it creates a dedicated
 * branch, asks one executor to repair the selected diagnostics, and adopts that
 * branch through the normal gates and pull request flow. Info diagnostics stay
 * opt-in; the default is error and warning.
 */
export async function runDiagnostics({ config, stateStore, options, log }) {
  const severities = parseSeverities(options.severity)
  const artifacts = new Artifacts(config, `diagnostics-${Date.now()}`)
  await artifacts.init()
  const initial = await runBuildDiagnostics({ config, artifacts, severities })
  const report = {
    status: initial.exitCode !== 0 && initial.diagnostics.length === 0
      ? 'build-failed'
      : initial.diagnostics.length === 0 ? 'clean' : 'diagnostics',
    severities,
    exitCode: initial.exitCode,
    summary: initial.summary,
    diagnostics: initial.diagnostics
  }
  if (options.fix !== true || initial.diagnostics.length === 0) return report

  const dirty = await git.statusTrackedPorcelain(config.repoPath)
  if (dirty) throw new Error(`The working tree has tracked changes:\n${dirty}\nCommit, stash, or discard them before diagnostics --fix.`)

  const branch = String(options.branch ?? 'chore/compiler-diagnostics').trim()
  const baseBranch = config.baseBranch
  await git.fetch(config.repoPath)
  if (await git.branchExists(config.repoPath, branch)) {
    const switched = await git.switchTicketBranch(config.repoPath, branch)
    if (!switched.ok) throw new Error(`Could not switch to ${branch}: ${switched.error}`)
  } else {
    await git.createBranchFrom(config.repoPath, branch, baseBranch)
  }

  const execution = await runSession({
    config,
    prompt: 'diagnostics-fix',
    agent: config.agents.executor,
    payload: {
      branch,
      baseBranch,
      diagnostics: initial.diagnostics,
      severities,
      restoreCommand: config.restoreCommand,
      buildCommand: config.buildCommand,
      testCommand: config.testCommand,
      stateDir: config.stateDir,
      commitSubject: 'chore: fix compiler diagnostics'
    },
    title: `AutopAI diagnostics ${branch}`,
    logFile: artifacts.path('diagnostics-fix.log'),
    role: 'executor'
  })
  const blockers = await listBlockers(config)
  if (blockers.length > 0) throw new Error(blockerMessage(blockers))
  if (execution.code !== 0) throw new Error(`Diagnostics fix session failed with exit ${execution.code}.`)
  await git.normalizeHeadCommitMessage({ repoPath: config.repoPath, log })

  const commits = await git.logCommits(config.repoPath, `origin/${baseBranch}..${branch}`)
  if (commits.length === 0) throw new Error('The diagnostics fix session produced no commits.')

  const tempStateDir = path.join(config.stateDir, 'diagnostics', String(Date.now()))
  const adoptConfig = { ...config, stateDir: tempStateDir }
  const adoptStore = new StateStore(adoptConfig)
  const adopted = await runAdopt({
    config: adoptConfig,
    stateStore: adoptStore,
    options: {
      branch,
      base: baseBranch,
      title: 'chore: fix compiler diagnostics'
    },
    log
  })

  return {
    ...report,
    status: 'fixed',
    branch,
    prNumber: adopted.prNumber,
    mergeCommit: adopted.mergeCommit,
    commits: adopted.commits
  }
}