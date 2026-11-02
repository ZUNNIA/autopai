import * as git from '../lib/git.js'
import { runSession } from '../lib/session.js'
import { Artifacts } from '../lib/artifacts.js'
import { listBlockers, blockerMessage } from '../lib/blockers.js'
import * as github from '../lib/github.js'

/**
 * Prepares a conflicting pull request branch for human review. The command does
 * not commit, push, rebase or force anything; it leaves the resolved work tree
 * for the user to inspect and finish.
 */
export async function runResolveConflicts({ config, stateStore, options, log }) {
  const state = await stateStore.load()
  const prNumber = Number(options.pr ?? state?.prNumber ?? 0)
  if (!prNumber) throw new Error('No pull request was provided. Pass --pr <number> or run status first.')

  const pr = await github.prView(config.repoPath, prNumber)
  if (!pr || pr.state !== 'OPEN') throw new Error(`Pull request #${prNumber} is not open.`)
  if (pr.mergeable !== 'CONFLICTING' && pr.mergeStateStatus !== 'DIRTY') {
    return { prNumber, status: 'no-conflict', branch: pr.headRefName, message: 'The pull request is not reporting merge conflicts.' }
  }

  const dirty = await git.statusTrackedPorcelain(config.repoPath)
  if (dirty) {
    throw new Error(`The working tree has tracked changes:\n${dirty}\nCommit, stash, or discard them before resolving conflicts.`)
  }

  const artifacts = new Artifacts(config, state?.runId ?? `conflicts-${Date.now()}`)
  await artifacts.init()
  await git.fetch(config.repoPath)
  const switched = await git.switchTicketBranch(config.repoPath, pr.headRefName)
  if (!switched.ok) throw new Error(`Could not switch to ${pr.headRefName}: ${switched.error}\n${switched.action ?? ''}`.trim())

  const merge = await git.mergeIntoCurrent(config.repoPath, `origin/${pr.baseRefName}`)
  const conflicts = await git.conflictedFiles(config.repoPath)
  if (conflicts.length === 0) {
    return {
      prNumber,
      status: merge.ok ? 'clean-merge-ready-to-review' : 'merge-stopped',
      branch: pr.headRefName,
      baseBranch: pr.baseRefName,
      mergeOutput: merge.text,
      message: 'Review the staged merge, run the gates, then commit and push manually.'
    }
  }

  await log?.(`Conflicts in ${conflicts.length} file(s). Starting one resolution session.`)
  const execution = await runSession({
    config,
    prompt: 'resolve-conflicts',
    agent: config.agents.executor,
    payload: {
      prNumber,
      branch: pr.headRefName,
      baseBranch: pr.baseRefName,
      conflicts,
      restoreCommand: config.restoreCommand,
      buildCommand: config.buildCommand,
      testCommand: config.testCommand,
      stateDir: config.stateDir
    },
    title: `AutopAI resolve conflicts PR ${prNumber}`,
    logFile: artifacts.path('resolve-conflicts.log'),
    role: 'executor'
  })
  const blockers = await listBlockers(config)
  if (blockers.length > 0) throw new Error(blockerMessage(blockers))
  if (execution.code !== 0) throw new Error(`Conflict resolution session failed with exit ${execution.code}.`)

  const remaining = await git.conflictedFiles(config.repoPath)
  return {
    prNumber,
    status: remaining.length === 0 ? 'resolved-ready-to-review' : 'remaining-conflicts',
    branch: pr.headRefName,
    baseBranch: pr.baseRefName,
    conflicts,
    remaining,
    message: 'Review the changes, run the gates, then commit and push manually. The command did not commit, push, or merge.'
  }
}