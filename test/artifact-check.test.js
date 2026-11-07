import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { checkArtifacts } from '../src/lib/artifact-check.js'

const dirs = {
  backlog: 'tickets/backlog',
  readyForDev: 'tickets/ready-for-dev',
  identified: 'tickets/identified',
  readyForRefactor: 'tickets/ready-for-refactor',
  ux: 'tickets/ux',
  qa: 'tickets/qa',
  done: 'tickets/done'
}

test('artifacts check validates every local artifact kind', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-artifacts-check-'))
  await write(repo, 'tickets/backlog/demo/brief.md', brief())
  await write(repo, 'tickets/backlog/demo/backlog.md', backlog())
  await write(repo, 'tickets/ready-for-dev/demo/001-demo.md', devTicket())
  await write(repo, 'tickets/identified/demo/001-finding.md', finding())
  await write(repo, 'tickets/ready-for-refactor/001-refactor.md', refactorTicket())
  await write(repo, 'tickets/ux/001-proposal.md', uxProposal())

  const report = await checkArtifacts({ repoPath: repo, ticketDirs: dirs })
  assert.equal(report.ok, true)
  assert.equal(report.checked, 6)

  await write(repo, 'tickets/ready-for-dev/demo/002-broken.md', devTicket().replace('## 3. Implementation', '## Missing'))
  const broken = await checkArtifacts({ repoPath: repo, ticketDirs: dirs })
  assert.equal(broken.ok, false)
  assert.equal(broken.failed, 1)
})

async function write(repo, relative, content) {
  const file = path.join(repo, relative)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content, 'utf8')
}

function brief() {
  return ['# Feature Brief: Demo', '', '## Problem', 'P.', '', '## Scope', 'S.', '', '## Non-goals', 'N.', '', '## Constraints', 'C.', '', '## Acceptance Criteria', 'A.', '', '## External References', 'N/A'].join('\n')
}

function backlog() {
  return ['# Backlog', '', 'Billing impact: none', '', '## 0. Classification', '* [x] **Important:** extra.', '', '## 1. Objective', 'O.', '', '## 2. Work Organization', '### 1: Demo', '#### Subtasks:', '* **1A)** Do it.', '', '## 3. Golden Rules for a Backlog', 'R.'].join('\n')
}

function devTicket() {
  return ['---', 'id: demo', 'feature: demo', 'type: feat', 'priority: important', 'billing: none', 'depends_on: []', '---', '', '# Demo', '', '## 0. Classification', '* [x] **Important:** extra.', '', '## 1. Objective', 'O.', '', '## 2. Files', 'F.', '', '## 3. Implementation', 'I.', '', '## 4. Acceptance Criteria', 'A.', '', '## 5. Technical Notes', 'T.', '', '## 6. Manual Verification', 'None.'].join('\n')
}

function finding() {
  return ['# Finding', '', 'Billing impact: none', '', '## 0. Classification', '* [x] **Code Smell:** duplication.', '* [x] **Important:** costs time.', '', '## 1. Objective', 'O.', '', '## 2. Evidence', 'E.', '', '## 3. Impact', 'I.', '', '## 4. References', 'R.'].join('\n')
}

function refactorTicket() {
  return ['---', 'id: demo', 'feature: tech-debt', 'type: refactor', 'classification: code-smell', 'priority: important', 'billing: none', 'depends_on: []', '---', '', '# Demo', '', '## 0. Classification', '* [x] **Code Smell:** duplication.', '* [x] **Important:** costs time.', '', '## 1. Objective', 'O.', '', '## 2. Files', 'F.', '', '## 3. Refactoring Strategy', 'S.', '', '## 4. Risk Mitigation Plan', 'R.', '', '## 5. Acceptance Criteria', 'A.', '', '## 6. Technical Notes and Design Decisions', 'T.'].join('\n')
}

function uxProposal() {
  return ['# UX Proposal: Demo', '', '## Context', 'C.', '', '## Observation', 'O.', '', '## Impact', 'I.', '', '## Proposal', 'P.', '', '## Alternatives', 'A.'].join('\n')
}
