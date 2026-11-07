import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
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
