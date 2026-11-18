import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createAdr, nextAdrNumber, resolveAdrDirectory } from '../src/lib/adr.js'

test('creates the next numbered ADR in the existing ADR directory', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-adr-'))
  await fs.mkdir(path.join(repo, 'tickets', 'adr'), { recursive: true })
  await fs.writeFile(path.join(repo, 'tickets', 'adr', '004-old.md'), '# old\n', 'utf8')

  assert.equal(await resolveAdrDirectory(repo), path.join(repo, 'tickets', 'adr'))
  assert.equal(await nextAdrNumber(path.join(repo, 'tickets', 'adr')), 5)
  const created = await createAdr({ repoPath: repo, title: 'Use local synthesis' })
  assert.equal(created.number, '005')
  assert.equal(created.file, path.join(repo, 'tickets', 'adr', '005-use-local-synthesis.md'))
  const text = await fs.readFile(created.file, 'utf8')
  assert.match(text, /# 005: Use local synthesis/)
  assert.match(text, /## 4\. Decision/)
})

test('creates docs/adr when tickets/adr does not exist', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-adr-docs-'))
  await fs.mkdir(path.join(repo, 'docs', 'adr'), { recursive: true })
  assert.equal(await resolveAdrDirectory(repo), path.join(repo, 'docs', 'adr'))
})

test('writes provided ADR content with resolved placeholders', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-adr-content-'))
  await fs.mkdir(path.join(repo, 'tickets', 'adr'), { recursive: true })
  const content = `# {{number}}: {{title}}

## 1. Title, Status & Category

- **Title:** {{number}}: {{title}}
- **Status:** {{status}}

## 2. Context

Context.

## 3. Options Considered

Option A.

## 4. Decision

Use the decided option.

## 5. Consequences

The decision holds.
`
  const created = await createAdr({
    repoPath: repo,
    title: 'Use local synthesis',
    status: 'Accepted',
    content
  })
  assert.equal(created.number, '001')
  const text = await fs.readFile(created.file, 'utf8')
  assert.match(text, /^# 001: Use local synthesis/)
  assert.match(text, /\*\*Status:\*\* Accepted/)
})

test('prepends the heading when the content starts at section 1', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-adr-heading-'))
  await fs.mkdir(path.join(repo, 'tickets', 'adr'), { recursive: true })
  const content = `## 1. Title, Status & Category

- **Status:** Proposed

## 2. Context

Context.

## 3. Options Considered

Option A.

## 4. Decision

Decision.

## 5. Consequences

Consequences.
`
  const created = await createAdr({ repoPath: repo, title: 'Local decision', content })
  const text = await fs.readFile(created.file, 'utf8')
  assert.match(text, /^# 001: Local decision\n\n## 1\./)
})

test('rejects ADR content without the required sections', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-adr-invalid-'))
  await fs.mkdir(path.join(repo, 'tickets', 'adr'), { recursive: true })
  await assert.rejects(
    createAdr({ repoPath: repo, title: 'Broken', content: '# Broken\n\n## 1. Title\n' }),
    /section 2/
  )
})

test('rejects ADR content with a mismatched heading', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-adr-heading-mismatch-'))
  await fs.mkdir(path.join(repo, 'tickets', 'adr'), { recursive: true })
  const content = `# Wrong heading

## 1. Title, Status & Category

- **Status:** Proposed

## 2. Context

Context.

## 3. Options Considered

Option A.

## 4. Decision

Decision.

## 5. Consequences

Consequences.
`
  await assert.rejects(
    createAdr({ repoPath: repo, title: 'Expected title', content }),
    /heading must be/
  )
})

test('adr new reads the content file through the CLI', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-adr-cli-'))
  await fs.mkdir(path.join(repo, 'tickets', 'adr'), { recursive: true })
  const contentFile = path.join(repo, 'adr-content.md')
  await fs.writeFile(contentFile, `# {{number}}: {{title}}

## 1. Title, Status & Category

- **Status:** {{status}}

## 2. Context

Context.

## 3. Options Considered

Option A.

## 4. Decision

Decision.

## 5. Consequences

Consequences.
`, 'utf8')

  const cli = path.resolve('src/cli.js')
  const output = execFileSync(process.execPath, [
    cli,
    'adr',
    'new',
    '--repo',
    repo,
    '--title',
    'Use local synthesis',
    '--status',
    'Accepted',
    '--content-file',
    contentFile
  ], { encoding: 'utf8' }).trim()

  const text = await fs.readFile(output, 'utf8')
  assert.match(text, /^# 001: Use local synthesis/)
  assert.match(text, /\*\*Status:\*\* Accepted/)
})
