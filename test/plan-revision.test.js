import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { loadConfig } from '../src/lib/config.js'
import { StateStore } from '../src/lib/state.js'
import { runRevisePlan } from '../src/phases/pipeline.js'

const TICKET = `---
id: 01-native-fix
feature: history-review
type: feat
priority: urgent
billing: none
depends_on: []
---

# Fix the native surface

## 0. Classification

* [x] Urgent: Core functionality.

## 1. Objective

Fix the native surface lifetime.

## 2. Files

### New files

* None.

### Modified files

* \`src/surface.cs\`

## 3. Implementation

Clear the native player before releasing it.

## 4. Acceptance Criteria

The surface is empty after release.

## 5. Technical Notes

No new dependency.

## 6. Manual Verification

Run the native smoke test.
`

test('revise-plan edits ready-for-dev tickets and keeps the plan gate', async t => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-revise-plan-'))
  t.after(() => fs.rm(repo, { recursive: true, force: true }))
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' })

  const feature = 'history-review'
  const readyDir = path.join(repo, 'tickets', 'ready-for-dev', feature)
  await fs.mkdir(readyDir, { recursive: true })
  const ticket = path.join(readyDir, '01-native-fix.md')
  await fs.writeFile(ticket, TICKET, 'utf8')

  const script = path.join(repo, 'fake-planner.js')
  await fs.writeFile(script, `
    import fs from 'node:fs/promises'
    const target = ${JSON.stringify(ticket)}
    const text = await fs.readFile(target, 'utf8')
    await fs.writeFile(target, text + '\\n<!-- revised -->\\n')
    process.stdout.write('Revised the native surface ticket.\\n')
  `, 'utf8')

  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({
    runner: 'command',
    runnerOptions: {
      run: [process.execPath, script],
      prompt: 'stdin'
    },
    baseBranch: 'develop',
    releaseBranch: 'master',
    stateDir: 'tickets/.autopai'
  }), 'utf8')

  const config = await loadConfig(repo)
  const stateStore = new StateStore(config)
  const state = await stateStore.create('approve', { feature })
  state.phase = 'approved'
  await stateStore.save(state)

  const result = await runRevisePlan({
    config,
    stateStore,
    options: { message: 'Clarify the release ordering.', ticket: '01-native-fix' },
    log: () => {}
  })

  assert.equal(result.targetTicket, '01-native-fix')
  assert.deepEqual(result.changed, ['01-native-fix.md'])
  assert.match(await fs.readFile(ticket, 'utf8'), /<!-- revised -->/)
  assert.equal((await stateStore.load()).phase, 'approved')
  assert.equal(result.tickets[0].file, 'tickets/ready-for-dev/history-review/01-native-fix.md')
  assert.equal(await fs.access(result.logFile).then(() => true), true)
})

test('revise-plan passes the structured review file to the planner', async t => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-revise-review-'))
  t.after(() => fs.rm(repo, { recursive: true, force: true }))
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' })

  const feature = 'history-review'
  const readyDir = path.join(repo, 'tickets', 'ready-for-dev', feature)
  await fs.mkdir(readyDir, { recursive: true })
  const ticket = path.join(readyDir, '01-native-fix.md')
  await fs.writeFile(ticket, TICKET, 'utf8')
  const reviewFile = path.join(repo, 'review.json')
  await fs.writeFile(reviewFile, JSON.stringify({
    verdict: 'revise',
    coverage: [{ id: 'AC-1', requirement: 'The surface is empty.', status: 'missing', evidence: [], tickets: [], note: 'structured test' }],
    gaps: [{ id: 'GAP-1', severity: 'blocking', coverageId: 'AC-1', requirement: 'Cover it.', evidence: [], requiredChange: 'Add it.' }]
  }), 'utf8')

  const script = path.join(repo, 'fake-review-planner.js')
  await fs.writeFile(script, `
    import fs from 'node:fs/promises'
    let input = ''
    process.stdin.on('data', chunk => { input += chunk })
    process.stdin.on('end', async () => {
      if (!input.includes('structured test')) process.exit(3)
      await fs.appendFile(${JSON.stringify(ticket)}, '\\n<!-- review applied -->\\n')
      process.stdout.write(JSON.stringify({ changed: ['01-native-fix.md'] }) + '\\n')
    })
  `, 'utf8')

  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({
    runner: 'command',
    runnerOptions: {
      run: [process.execPath, script],
      prompt: 'stdin'
    },
    baseBranch: 'develop',
    releaseBranch: 'master',
    stateDir: 'tickets/.autopai'
  }), 'utf8')

  const config = await loadConfig(repo)
  const stateStore = new StateStore(config)
  const state = await stateStore.create('approve', { feature })
  state.phase = 'approved'
  await stateStore.save(state)

  const result = await runRevisePlan({
    config,
    stateStore,
    options: { message: 'Apply the review.', reviewFile },
    log: () => {}
  })

  assert.match(await fs.readFile(ticket, 'utf8'), /review applied/)
  assert.deepEqual(result.changed, ['01-native-fix.md'])
})

test('revise-plan edits summary documents only when explicitly included', async t => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-revise-summary-'))
  t.after(() => fs.rm(repo, { recursive: true, force: true }))
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' })

  const feature = 'history-review'
  const readyDir = path.join(repo, 'tickets', 'ready-for-dev', feature)
  const backlogDir = path.join(repo, 'tickets', 'backlog', feature)
  await fs.mkdir(readyDir, { recursive: true })
  await fs.mkdir(backlogDir, { recursive: true })
  const ticket = path.join(readyDir, '01-native-fix.md')
  const brief = path.join(backlogDir, 'brief.md')
  const backlog = path.join(backlogDir, 'backlog.md')
  await fs.writeFile(ticket, TICKET, 'utf8')
  const briefText = `# Brief

## Problem

The surface leaks.

## Scope

Fix the surface.

## Non-goals

No redesign.

## Constraints

Keep the API.

## Acceptance Criteria

The surface is empty.

## External References

N/A - Internal logic only.
`
  const backlogText = `# Backlog

Billing impact: none

## 0. Classification

* [x] Urgent.

## 1. Objective

Fix the surface.

## 2. Work Organization

### 1: Surface

#### Subtasks:

* Clear the surface.

## 3. Golden Rules for a Backlog
`
  await fs.writeFile(brief, briefText, 'utf8')
  await fs.writeFile(backlog, backlogText, 'utf8')

  const script = path.join(repo, 'fake-summary-planner.js')
  await fs.writeFile(script, `
    import fs from 'node:fs/promises'
    await fs.appendFile(${JSON.stringify(brief)}, '\\n<!-- summary revised -->\\n')
    await fs.appendFile(${JSON.stringify(backlog)}, '\\n<!-- summary revised -->\\n')
    process.stdout.write('Revised the summary documents.\\n')
  `, 'utf8')

  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({
    runner: 'command',
    runnerOptions: {
      run: [process.execPath, script],
      prompt: 'stdin'
    },
    baseBranch: 'develop',
    releaseBranch: 'master',
    stateDir: 'tickets/.autopai'
  }), 'utf8')

  const config = await loadConfig(repo)
  const stateStore = new StateStore(config)
  const state = await stateStore.create('approve', { feature })
  state.phase = 'approved'
  await stateStore.save(state)

  await assert.rejects(
    runRevisePlan({
      config,
      stateStore,
      options: { message: 'Reconcile the summary.' },
      log: () => {}
    }),
    /modified the brief or backlog/
  )
  assert.equal(await fs.readFile(brief, 'utf8'), briefText)
  assert.equal(await fs.readFile(backlog, 'utf8'), backlogText)

  const result = await runRevisePlan({
    config,
    stateStore,
    options: { message: 'Reconcile the summary.', includeSummary: true },
    log: () => {}
  })
  assert.equal(result.includeSummary, true)
  assert.deepEqual(result.summaryDocs.sort(), [
    'tickets/backlog/history-review/backlog.md',
    'tickets/backlog/history-review/brief.md'
  ])
  assert.match(await fs.readFile(brief, 'utf8'), /summary revised/)
  assert.match(await fs.readFile(backlog, 'utf8'), /summary revised/)
  assert.equal((await stateStore.load()).phase, 'approved')
})

test('revise-plan refuses a run that is not at the plan gate', async () => {
  const cli = await fs.readFile('src/cli.js', 'utf8')
  const pipeline = await fs.readFile('src/phases/pipeline.js', 'utf8')
  const prompt = await fs.readFile('src/prompts/ready-for-dev-revision.md', 'utf8')
  const agent = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')

  assert.match(cli, /revise-plan/)
  assert.match(pipeline, /runRevisePlan/)
  assert.match(pipeline, /currentGate\(state\) !== 'plan'/)
  assert.match(pipeline, /stay|plan gate|phase !== 'approved'/i)
  assert.match(pipeline, /targetTicket/)
  assert.match(pipeline, /includeSummary/)
  assert.match(pipeline, /summaryDocs/)
  assert.match(prompt, /When `targetTicket` is present, edit only that ticket file/)
  assert.match(prompt, /includeSummary/)
  assert.match(prompt, /Never approve the plan/)
  assert.match(prompt, /Never edit source code/)
  assert.match(prompt, /covers/)
  assert.match(prompt, /self-audit/i)
  assert.match(prompt, /review/)
  assert.match(agent, /autopai revise-plan/)
  assert.match(agent, /--include-summary/)
})
