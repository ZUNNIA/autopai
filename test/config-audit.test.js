import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { auditConfig, formatConfigReport } from '../src/lib/config-audit.js'

const fullConfig = {
  runner: 'opencode',
  runnerOptions: {},
  protectedPaths: ['.github/**', 'AGENTS.md', 'autopai.json'],
  baseBranch: 'main',
  releaseBranch: 'main',
  requiredChecks: [],
  ignoredChecks: [],
  restoreCommand: null,
  buildCommand: null,
  testCommand: null,
  smokeCommand: null,
  coverageThreshold: null,
  auditChunkFiles: 40,
  localGateRetries: 1,
  continueOnFailure: true,
  maxAttempts: 3,
  maxMinutes: 240,
  commandTimeoutMinutes: 30,
  sessionTimeoutMinutes: 90,
  checkPollSeconds: 30,
  checkTimeoutMinutes: 30,
  billingCurrency: 'USD',
  pauseAfter: ['backlog', 'plan', 'qa'],
  prTitle: null,
  runtimeLogs: [],
  commitTypes: ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore'],
  agents: { executor: 'executor', planner: 'planner', auditor: 'auditor', operator: 'autopai' },
  models: { executor: null, planner: null, auditor: null, operator: null },
  ticketDirs: {
    backlog: 'tickets/backlog',
    readyForDev: 'tickets/ready-for-dev',
    identified: 'tickets/identified',
    readyForRefactor: 'tickets/ready-for-refactor',
    ux: 'tickets/ux',
    qa: 'tickets/qa',
    done: 'tickets/done'
  },
  stateDir: 'tickets/.autopai'
}

async function repoWith(value) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-audit-'))
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  await fs.writeFile(path.join(repo, 'autopai.json'), text, 'utf8')
  return repo
}

test('accepts a complete current configuration', async () => {
  const repo = await repoWith(fullConfig)
  const report = await auditConfig(repo)
  assert.equal(report.ok, true)
  assert.equal(report.status, 'current')
  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.warnings, [])
  assert.deepEqual(report.missing, [])
})

test('reports missing defaults without failing', async () => {
  const repo = await repoWith({ runner: 'opencode' })
  const report = await auditConfig(repo)
  assert.equal(report.ok, true)
  assert.equal(report.status, 'outdated')
  assert.ok(report.missing.some(item => item.field === 'pauseAfter'))
  assert.ok(report.missing.some(item => item.field === 'billingCurrency'))
  assert.ok(report.missing.some(item => item.field === 'ticketDirs'))
  assert.ok(report.missing.some(item => item.field === 'stateDir'))
  assert.ok(formatConfigReport(report).includes('MISSING pauseAfter'))
})

test('reports missing required fields, unknown runners, and invalid JSON', async () => {
  const missing = await repoWith({ baseBranch: 'main', releaseBranch: 'main' })
  const missingReport = await auditConfig(missing)
  assert.equal(missingReport.ok, false)
  assert.ok(missingReport.errors.some(error => error.code === 'missing-required' && error.field === 'runner'))

  const unknownRunner = await repoWith({ ...fullConfig, runner: 'nope' })
  const runnerReport = await auditConfig(unknownRunner)
  assert.equal(runnerReport.ok, false)
  assert.ok(runnerReport.errors.some(error => error.code === 'unknown-runner' && error.field === 'runner'))

  const invalid = await repoWith('{ not json')
  const invalidReport = await auditConfig(invalid)
  assert.equal(invalidReport.ok, false)
  assert.ok(invalidReport.errors.some(error => error.code === 'invalid-json'))
})

test('reports unknown top-level and nested fields', async () => {
  const repo = await repoWith({
    ...fullConfig,
    mystery: true,
    agents: { ...fullConfig.agents, ghost: 'x' },
    models: { ...fullConfig.models, ghost: 'x' },
    ticketDirs: { ...fullConfig.ticketDirs, ghost: 'tickets/ghost' }
  })
  const report = await auditConfig(repo)
  assert.equal(report.ok, false)
  assert.ok(report.unknown.includes('mystery'))
  assert.ok(report.unknown.includes('agents.ghost'))
  assert.ok(report.unknown.includes('models.ghost'))
  assert.ok(report.unknown.includes('ticketDirs.ghost'))
})

test('warns about deprecated, legacy, secret-like, and personal fields', async () => {
  const repo = await repoWith({
    ...fullConfig,
    autoMerge: true,
    approvalRequired: true,
    agents: { ...fullConfig.agents, executor: 'autopai', operator: 'setup' },
    runnerOptions: { env: { OPENAI_API_KEY: 'not-a-secret' } },
    runtimeLogs: ['C:\\Users\\someone\\log.txt']
  })
  const report = await auditConfig(repo)
  assert.equal(report.ok, true)
  assert.equal(report.status, 'warning')
  assert.deepEqual(report.deprecated, ['autoMerge', 'approvalRequired'])
  assert.ok(report.warnings.some(warning => warning.code === 'legacy-agent' && warning.field === 'agents.executor'))
  assert.ok(report.warnings.some(warning => warning.code === 'secret-like'))
  assert.ok(report.warnings.some(warning => warning.code === 'personal-path'))
})

test('rejects invalid types, values, paths, and pause gates', async () => {
  const repo = await repoWith({
    ...fullConfig,
    coverageThreshold: 1.5,
    billingCurrency: 'usd',
    pauseAfter: ['nope'],
    requiredChecks: 'Build',
    auditChunkFiles: 0,
    localGateRetries: -1,
    continueOnFailure: 'yes',
    ticketDirs: { ...fullConfig.ticketDirs, qa: 'C:\\private\\qa' },
    stateDir: '../outside'
  })
  const report = await auditConfig(repo)
  assert.equal(report.ok, false)
  const fields = report.errors.map(error => error.field)
  assert.ok(fields.includes('coverageThreshold'))
  assert.ok(fields.includes('billingCurrency'))
  assert.ok(fields.includes('pauseAfter'))
  assert.ok(fields.includes('requiredChecks'))
  assert.ok(fields.includes('auditChunkFiles'))
  assert.ok(fields.includes('localGateRetries'))
  assert.ok(fields.includes('continueOnFailure'))
  assert.ok(fields.includes('ticketDirs.qa'))
  assert.ok(fields.includes('stateDir'))
})

test('reports a missing configuration file', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-audit-missing-'))
  const report = await auditConfig(repo)
  assert.equal(report.exists, false)
  assert.equal(report.ok, false)
  assert.ok(report.errors.some(error => error.code === 'missing-file'))
})
