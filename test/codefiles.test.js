import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { listCodeFiles } from '../src/lib/codefiles.js'

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

test('lists code files and honors every git ignore rule', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-codefiles-'))
  git(repo, ['init', '--quiet'])
  await fs.writeFile(path.join(repo, '.gitignore'), 'bin/\ntickets/\n', 'utf8')
  await fs.mkdir(path.join(repo, 'Services', 'Sub'), { recursive: true })
  await fs.mkdir(path.join(repo, 'Utils'), { recursive: true })
  await fs.mkdir(path.join(repo, 'bin'), { recursive: true })
  await fs.mkdir(path.join(repo, 'tickets'), { recursive: true })
  await fs.writeFile(path.join(repo, 'Services', 'A.cs'), 'class A {}\n', 'utf8')
  await fs.writeFile(path.join(repo, 'Services', 'Sub', 'B.py'), 'print(1)\n', 'utf8')
  await fs.writeFile(path.join(repo, 'Utils', 'C.cs'), 'class C {}\n', 'utf8')
  await fs.writeFile(path.join(repo, 'bin', 'Gen.cs'), 'class Gen {}\n', 'utf8')
  await fs.writeFile(path.join(repo, 'tickets', 'T.cs'), 'class T {}\n', 'utf8')
  await fs.writeFile(path.join(repo, 'README.md'), '# Readme\n', 'utf8')
  git(repo, ['add', 'Services/A.cs', 'Services/Sub/B.py', 'README.md'])
  git(repo, ['-c', 'user.email=test@example.com', '-c', 'user.name=AutopAI Test', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'chore: seed the test repository'])

  assert.deepEqual(await listCodeFiles(repo, '.'), ['Services/A.cs', 'Services/Sub/B.py', 'Utils/C.cs'])
  assert.deepEqual(await listCodeFiles(repo, 'Services'), ['Services/A.cs', 'Services/Sub/B.py'])
  assert.deepEqual(await listCodeFiles(repo, 'missing'), [])
})
