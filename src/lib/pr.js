import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from './git.js'
import * as github from './github.js'
import { runSession } from './session.js'
import { listBlockers, blockerMessage } from './blockers.js'
import { scanBranch, scanRepositoryFiles, formatViolations, validatePrBody } from './policy.js'
import { findForbidden } from './forbidden.js'
import { runGates, gateFailureText } from './gates.js'
import { generateMergeBody } from './title.js'
import { ensureDir, sleep, truncate } from './util.js'

const FAILED_STATES = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'])
const PENDING_STATES = new Set(['PENDING', 'QUEUED', 'IN_PROGRESS', 'WAITING', 'REQUESTED'])

/**
 * Creates or reuses the pull request for a branch. The branch must already be
 * pushed. Returns the PR number and state.
 */
export async function ensurePullRequest({ config, branch, baseBranch, title, body, logFile }) {
  const existing = await github.prListByHead(config.repoPath, branch)
  const open = existing.find(pr => pr.state === 'OPEN')
  if (open) {
    if (open.baseRefName !== baseBranch) {
      throw new Error(`An open pull request for ${branch} targets ${open.baseRefName}, not ${baseBranch}.`)
    }
    return open
  }
  const merged = existing.find(pr => pr.state === 'MERGED')
  if (merged) return merged

  const bodyViolations = validatePrBody(body)
  if (bodyViolations.length > 0) {
    throw new Error(`PR body violates policy:\n${formatViolations(bodyViolations)}`)
  }

  const created = await github.prCreate(config.repoPath, {
    base: baseBranch,
    head: branch,
    title,
    body
  })
  if (!created.number) throw new Error('Could not parse the pull request number from gh pr create.')
  return { number: created.number, state: 'OPEN', url: created.url, title }
}

/**
 * Waits until every required check succeeds and every non-ignored check is
 * terminal. Unknown checks are treated as blocking unless explicitly ignored.
 */
export async function waitForChecks({ config, artifacts, prNumber }) {
  const started = Date.now()
  const deadline = started + config.checkTimeoutMinutes * 60000
  let lastChecks = []

  while (Date.now() < deadline) {
    const result = await github.prChecks(config.repoPath, prNumber)
    lastChecks = result.checks
    await artifacts.write('checks-latest.json', JSON.stringify(lastChecks, null, 2))

    const ignored = new Set(config.ignoredChecks)
    const nonIgnored = lastChecks.filter(check => !ignored.has(check.name))
    const failed = nonIgnored.filter(check => FAILED_STATES.has(check.state))
    const pending = nonIgnored.filter(check => PENDING_STATES.has(check.state))
    const required = config.requiredChecks
    const requiredChecks = required.map(name => lastChecks.find(check => check.name === name))
    const missing = required.filter((name, index) => !requiredChecks[index])

    if (failed.length > 0) {
      return { ok: false, checks: lastChecks, failed, reason: 'One or more CI checks failed.' }
    }
    if (missing.length > 0 && Date.now() - started > 120000) {
      return { ok: false, checks: lastChecks, failed: [], reason: `Required checks were not reported: ${missing.join(', ')}` }
    }
    if (pending.length === 0) {
      if (required.length > 0 && requiredChecks.every(check => check?.state === 'SUCCESS')) {
        return { ok: true, checks: lastChecks }
      }
      if (required.length === 0 && nonIgnored.every(check => check.state === 'SUCCESS' || check.state === 'SKIPPED' || check.state === 'NEUTRAL')) {
        return { ok: true, checks: lastChecks }
      }
    }

    await sleep(config.checkPollSeconds * 1000)
  }

  return { ok: false, checks: lastChecks, failed: [], reason: 'Timed out waiting for CI checks.' }
}

export async function collectFailureLogs({ config, artifacts, checks, attempt }) {
  const failed = checks.filter(check => FAILED_STATES.has(check.state))
  const sections = []
  let usable = false
  for (const check of failed) {
    const log = await github.runFailedLog(config.repoPath, check)
    if (log.ok) usable = true
    sections.push(`### ${check.name} (${check.state})\n${log.text || check.link || 'No log available.'}`)
  }
  const text = sections.join('\n\n')
  await artifacts.write(`ci-failure-${attempt}.log`, text)
  return { text: truncate(text, 20000), usable, checks }
}

async function writeCiLogBlocker({ config, state, stateStore, executorPayload, checks }) {
  const failed = checks.filter(check => FAILED_STATES.has(check.state))
  const links = failed.map(check => check.link).filter(Boolean)
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const dir = path.join(config.stateDir, 'needs-human')
  await ensureDir(dir)
  const file = path.join(dir, `${stamp}-ci-log-unavailable.json`)
  const blocker = {
    ticketId: executorPayload?.ticketId ?? null,
    ticketFile: executorPayload?.ticketFile ?? null,
    reason: 'CI failed but no failure log is available. The orchestrator cannot tell the executor what to fix.',
    files: links,
    decision: 'A human must inspect the failed GitHub Actions job, restore log access, permissions, runner or billing, and re-run the job before resuming.',
    suggestedAction: 'Inspect the linked GitHub Actions job and restore CI access; then run autopai resume without --fix.'
  }
  await fs.writeFile(file, `${JSON.stringify(blocker, null, 2)}\n`, 'utf8')
  state.blockers = [...(state.blockers ?? []), file]
  await stateStore.save(state)
  return { ...blocker, file }
}

/**
 * Pushes the branch, opens or reuses a PR, waits for CI, asks the executor to
 * fix failures, and merges only after every required check passes.
 */
export async function pushOpenWaitMerge({
  config,
  artifacts,
  branch,
  baseBranch,
  title,
  prBody,
  state,
  stateStore,
  executorPrompt,
  executorPayload,
  coverage,
  log
}) {
  const existing = await github.prListByHead(config.repoPath, branch)
  const alreadyMerged = existing.find(pr => pr.state === 'MERGED')
  if (alreadyMerged) {
    const view = await github.prView(config.repoPath, alreadyMerged.number)
    return { prNumber: alreadyMerged.number, mergeCommit: view.mergeCommit?.oid ?? null, title: alreadyMerged.title, checks: [] }
  }

  const validation = await validateHead({ config, artifacts, baseBranch, branch, executorPayload })
  if (validation.fixed) {
    const validationGates = await runGates({ config, artifacts, prefix: 'policy-fix', retries: config.localGateRetries })
    if (!validationGates.ok) {
      throw new Error(`Local gates failed after the policy fix: ${gateFailureText(validationGates)}`)
    }
  }
  await git.push(config.repoPath, branch)
  await log?.(`Pushed ${branch}.`)

  const pr = await ensurePullRequest({
    config,
    branch,
    baseBranch,
    title,
    body: prBody,
    logFile: artifacts.path('pr-create.log')
  })
  state.prNumber = pr.number
  state.prTitle = title

  let checks = await waitForChecks({ config, artifacts, prNumber: pr.number })
  await log?.(`CI checks: ${checks.ok ? 'passed' : checks.reason}`)

  let attempt = 0
  while (!checks.ok && attempt < config.maxAttempts) {
    attempt += 1
    state.attempts = attempt
    const failure = await collectFailureLogs({ config, artifacts, checks: checks.checks, attempt })
    if (!failure.usable) {
      const blocker = await writeCiLogBlocker({
        config,
        state,
        stateStore,
        executorPayload,
        checks: failure.checks
      })
      throw new Error(blockerMessage([blocker]))
    }
    const failureLogs = failure.text
    await log?.(`CI failed. Executor fix attempt ${attempt}/${config.maxAttempts}.`)

    const execution = await runSession({
      config,
      prompt: executorPrompt,
      agent: config.agents.executor,
      payload: {
        ...executorPayload,
        attempt,
        failureLogs,
        failedChecks: checks.checks.filter(check => FAILED_STATES.has(check.state))
      },
      title: `AutopAI fix ${branch} attempt ${attempt}`,
      logFile: artifacts.path(`executor-fix-${attempt}.log`),
      role: 'executor'
    })
    const blockers = await listBlockers(config)
    if (blockers.length > 0) {
      state.blockers = blockers.map(blocker => blocker.file)
      await stateStore.save(state)
      throw new Error(blockerMessage(blockers))
    }
    if (execution.code !== 0) {
      throw new Error(`Executor failed while fixing CI (exit ${execution.code}). See ${artifacts.path(`executor-fix-${attempt}.log`)}.`)
    }

    await validateHead({ config, artifacts, baseBranch, branch, executorPayload })
    const gates = await runGates({ config, artifacts, prefix: `fix-${attempt}`, retries: config.localGateRetries })
    if (!gates.ok) {
      throw new Error(`Local gates failed after executor fix: ${gateFailureText(gates)}`)
    }

    await git.push(config.repoPath, branch)
    checks = await waitForChecks({ config, artifacts, prNumber: pr.number })
    await log?.(`CI checks after attempt ${attempt}: ${checks.ok ? 'passed' : checks.reason}`)
  }

  if (!checks.ok) {
    throw new Error(`CI did not pass after ${config.maxAttempts} attempts: ${checks.reason}`)
  }

  const view = await github.prView(config.repoPath, pr.number)
  if (view.mergeable === 'CONFLICTING') {
    throw new Error(`Pull request #${pr.number} has merge conflicts.`)
  }
  if (view.mergeStateStatus === 'BEHIND') {
    await github.prUpdateBranch(config.repoPath, pr.number)
    checks = await waitForChecks({ config, artifacts, prNumber: pr.number })
    if (!checks.ok) {
      throw new Error(`CI failed after updating the branch: ${checks.reason}`)
    }
  }

  const mergeBody = generateMergeBody({ prBody })
  await github.prMerge(config.repoPath, pr.number, { title, body: mergeBody })
  const merged = await github.prView(config.repoPath, pr.number)
  if (merged.state !== 'MERGED') {
    throw new Error(`Pull request #${pr.number} was not merged (state ${merged.state}).`)
  }

  await git.deleteRemoteBranch(config.repoPath, branch)
  await cleanupAfterMerge({ config, branch, baseBranch, log })
  return { prNumber: pr.number, mergeCommit: merged.mergeCommit?.oid ?? null, title, checks: checks.checks }
}

/**
 * Leaves the repository clean after a merge: prunes remote refs, fast-forwards
 * the local base branch, returns to it, and deletes the merged local branch.
 * Local divergences are reported and never overwritten.
 */
async function cleanupAfterMerge({ config, branch, baseBranch, log }) {
  await git.fetch(config.repoPath)
  if (!await git.syncLocalBranch(config.repoPath, baseBranch)) {
    await log?.(`Local ${baseBranch} could not be fast-forwarded; local cleanup was skipped.`)
    return
  }
  const current = await git.currentBranch(config.repoPath)
  if (current === branch && !await git.switchBranchSafe(config.repoPath, baseBranch)) {
    await log?.(`Could not switch to ${baseBranch}; the merged local branch was kept.`)
    return
  }
  if (await git.branchExists(config.repoPath, branch) && !await git.deleteLocalBranch(config.repoPath, branch)) {
    await log?.(`Local branch ${branch} was kept because it is not fully merged.`)
  }
}

/**
 * Revalidates branch, commits, and added code against the Git artifact policy.
 */
export async function validateHead({ config, artifacts, baseBranch, branch, executorPayload }) {
  const range = `origin/${baseBranch}...${branch}`
  const commits = await git.logCommits(config.repoPath, range)
  const diff = await git.diff(config.repoPath, range)
  const files = await git.diffNames(config.repoPath, range)
  const forbidden = findForbidden(files, config.protectedPaths)
  if (forbidden.length > 0) {
    throw new Error(`The branch modifies protected paths:\n${forbidden.join('\n')}`)
  }
  const violations = scanBranch({ branch, commits, diff })
  violations.push(...await scanRepositoryFiles(config.repoPath, files))
  await artifacts.write('policy-latest.json', JSON.stringify(violations, null, 2))
  if (violations.length === 0) return { fixed: false, violations: [] }
  if (violations.length > 0) {
    const message = formatViolations(violations)
    const execution = await runSession({
      config,
      prompt: 'autopai-finish',
      agent: config.agents.executor,
      payload: {
        ...executorPayload,
        mode: 'policy-fix',
        violations: message,
        branch,
        baseBranch
      },
      title: `AutopAI policy fix ${branch}`,
      logFile: artifacts.path('executor-policy.log'),
      role: 'executor'
    })
    if (execution.code !== 0) {
      throw new Error(`Policy violations could not be fixed automatically:\n${message}`)
    }
    const recheckCommits = await git.logCommits(config.repoPath, range)
    const recheckDiff = await git.diff(config.repoPath, range)
    const recheck = scanBranch({ branch, commits: recheckCommits, diff: recheckDiff })
    recheck.push(...await scanRepositoryFiles(config.repoPath, await git.diffNames(config.repoPath, range)))
    await artifacts.write('policy-latest.json', JSON.stringify(recheck, null, 2))
    if (recheck.length > 0) {
      throw new Error(`Policy violations remain:\n${formatViolations(recheck)}`)
    }
    return { fixed: true, violations: [] }
  }
}
