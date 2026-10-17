import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from '../lib/git.js'
import { runSession } from '../lib/session.js'
import { scanBranch, scanRepositoryFiles, formatViolations } from '../lib/policy.js'
import { runGates, gateFailureText } from '../lib/gates.js'
import { deriveTitle, generatePrBody, resolveTitle } from '../lib/title.js'
import { pushOpenWaitMerge } from '../lib/pr.js'
import { Artifacts } from '../lib/artifacts.js'
import { findForbidden } from '../lib/forbidden.js'

const ALLOWED_UNTRACKED = ['.autopilot.json', 'tickets/', '.autopilot/']

/**
 * Adopts an existing branch that already contains commits, finishes it, and
 * drives it through push, pull request, CI, and merge.
 */
export async function runAdopt({ config, stateStore, options, log }) {
  const branch = String(options.branch ?? await git.currentBranch(config.repoPath)).trim()
  const baseBranch = String(options.base ?? config.baseBranch)
  if (!branch) throw new Error('No branch was provided and the repository is not on a branch.')

  const current = await git.currentBranch(config.repoPath)
  if (current !== branch) {
    const blocking = await git.statusBlocking(config.repoPath, ALLOWED_UNTRACKED)
    if (blocking.length > 0) {
      throw new Error(`Cannot switch from ${current} to ${branch}: the working tree has pending tracked changes.`)
    }
    await git.switchBranch(config.repoPath, branch)
  }

  await git.fetch(config.repoPath)
  if (!await git.remoteBranchExists(config.repoPath, baseBranch)) {
    throw new Error(`Base branch origin/${baseBranch} does not exist.`)
  }
  if (!await git.branchExists(config.repoPath, branch)) {
    throw new Error(`Branch ${branch} does not exist locally.`)
  }
  const blocking = await git.statusBlocking(config.repoPath, ALLOWED_UNTRACKED)
  if (blocking.length > 0) {
    throw new Error(`The working tree must be clean before adopting the branch:\n${blocking.join('\n')}`)
  }

  const baseSha = await git.mergeBase(config.repoPath, `origin/${baseBranch}`, branch)
  const headSha = await git.revParse(config.repoPath, branch)
  if (baseSha === headSha) throw new Error(`Branch ${branch} has no commits over origin/${baseBranch}.`)

  const range = `origin/${baseBranch}...${branch}`
  const commits = await git.logCommits(config.repoPath, range)
  const diff = await git.diff(config.repoPath, range)
  const changedFiles = await git.diffNames(config.repoPath, range)

  const forbidden = findForbidden(changedFiles, config.protectedPaths)
  if (forbidden.length > 0) {
    throw new Error(`The branch changes protected paths and cannot be adopted automatically:\n${forbidden.join('\n')}`)
  }

  let violations = scanBranch({ branch, commits, diff })
  violations.push(...await scanRepositoryFiles(config.repoPath, changedFiles))

  if (options.dryRun) {
    return {
      dryRun: true,
      branch,
      baseBranch,
      derivedTitle: deriveTitle(branch, commits),
      commits: commits.map(item => item.subject),
      changedFiles,
      violations,
      message: 'Dry run: no executor, gates, push, PR, or merge were performed.'
    }
  }

  const state = await stateStore.create('adopt', { branch, baseBranch })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()
  state.baseSha = baseSha
  state.headSha = headSha
  state.changedFiles = changedFiles
  state.scopes = [{ name: branch, baseBranch, baseSha, headSha, changedFiles, patch: artifacts.path('branch.patch') }]
  await stateStore.save(state)
  await artifacts.write('branch.patch', diff)
  await artifacts.write('commits.txt', commits.map(item => `${item.sha} ${item.subject}`).join('\n'))
  await artifacts.write('changed-files.txt', changedFiles.join('\n'))

  let gates = await runGates({ config, artifacts, prefix: 'initial' })
  await log?.(`Initial policy violations: ${violations.length}. Local gates: ${gates.ok ? 'passed' : gates.reason}`)

  const titleFile = path.join(config.stateDir, 'pr-title.txt')
  await fs.rm(titleFile, { force: true })

  const needsExecutor = violations.length > 0 || !gates.ok
  if (!needsExecutor) {
    await log?.('Branch passes local gates. Asking the executor for the PR title and a final review.')
  }

  const payload = {
    mode: needsExecutor ? 'finish' : 'title',
    branch,
    baseBranch,
    baseSha,
    headSha,
    patchPath: artifacts.path('branch.patch'),
    changedFiles,
    violations: violations.length > 0 ? formatViolations(violations) : null,
    gateFailure: gates.ok ? null : gateFailureText(gates),
    restoreCommand: config.restoreCommand,
    buildCommand: config.buildCommand,
    testCommand: config.testCommand,
    stateDir: config.stateDir,
    prTitlePath: titleFile,
    instructions: 'Do not push, merge, rebase, or edit tickets, ADRs, CI, or autopilot configuration.'
  }

  const execution = await runSession({
    config,
    prompt: 'autopilot-finish',
    agent: config.agents.executor,
    payload,
    title: `autopilot finish ${branch}`,
    logFile: artifacts.path('executor-finish.log'),
    role: 'executor'
  })
  if (execution.code !== 0) {
    throw new Error(`Executor failed with exit code ${execution.code}. See ${artifacts.path('executor-finish.log')}.`)
  }

  const updatedCommits = await git.logCommits(config.repoPath, range)
  const updatedDiff = await git.diff(config.repoPath, range)
  const updatedFiles = await git.diffNames(config.repoPath, range)
  violations = scanBranch({ branch, commits: updatedCommits, diff: updatedDiff })
  violations.push(...await scanRepositoryFiles(config.repoPath, updatedFiles))
  gates = await runGates({ config, artifacts, prefix: 'final' })

  if (violations.length > 0) {
    await artifacts.write('policy-final.json', JSON.stringify(violations, null, 2))
    throw new Error(`Policy violations remain after the executor run:\n${formatViolations(violations)}`)
  }
  if (!gates.ok) {
    throw new Error(`Local gates failed after the executor run: ${gateFailureText(gates)}`)
  }

  const title = options.title
    ? String(options.title)
    : await resolveTitle({ config, branch, commits: updatedCommits })
  if (!title) throw new Error(`Could not resolve a PR title. Expected ${titleFile} or a title override.`)

  state.headSha = await git.revParse(config.repoPath, branch)
  state.changedFiles = updatedFiles
  state.scopes = [{ name: branch, baseBranch, baseSha, headSha: state.headSha, changedFiles: updatedFiles, patch: artifacts.path('branch.patch') }]
  state.prTitle = title
  await artifacts.write('branch.patch', updatedDiff)
  await artifacts.write('changed-files.txt', updatedFiles.join('\n'))
  await stateStore.save(state)

  const prBody = generatePrBody({ commits: updatedCommits, coverage: gates.coverage })
  const result = await pushOpenWaitMerge({
    config,
    artifacts,
    branch,
    baseBranch,
    title,
    prBody,
    state,
    executorPrompt: 'autopilot-finish',
    executorPayload: payload,
    coverage: gates.coverage,
    log
  })

  state.phase = 'merged'
  state.completedPhases = [...new Set([...state.completedPhases, 'adopt', 'merge'])]
  state.prNumber = result.prNumber
  state.mergeCommit = result.mergeCommit
  await stateStore.save(state)

  return {
    branch,
    baseBranch,
    title,
    prNumber: result.prNumber,
    mergeCommit: result.mergeCommit,
    commits: updatedCommits.map(item => item.subject),
    changedFiles: updatedFiles,
    coverage: gates.coverage
  }
}
