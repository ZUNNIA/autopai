import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { readCliDescription, readCliMessage, readCliTextFile } from '../src/lib/cli-message.js'

test('readCliMessage preserves every line from a message file', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-message-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'review.md')
  await fs.writeFile(file, 'First finding.\nSecond finding.\nThird finding.\n', 'utf8')

  const message = await readCliMessage({ messageFile: file }, 'Usage: test')
  assert.equal(message, 'First finding.\nSecond finding.\nThird finding.')
})

test('readCliMessage rejects direct and file forms together', async () => {
  await assert.rejects(
    readCliMessage({ message: 'Direct', messageFile: 'review.md' }, 'Usage: test'),
    /not both/
  )
  await assert.rejects(readCliMessage({}, 'Usage: test'), /Usage: test/)
  await assert.rejects(readCliMessage({ message: true }, 'Usage: test'), /Usage: test/)
})

test('readCliDescription preserves every line from a description file', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-description-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'description.md')
  await fs.writeFile(file, 'First constraint.\nSecond constraint.\n', 'utf8')

  const description = await readCliDescription({ descriptionFile: file }, 'Usage: test')
  assert.equal(description, 'First constraint.\nSecond constraint.')
})

test('readCliDescription rejects direct and file forms together', async () => {
  await assert.rejects(
    readCliDescription({ description: 'Direct', descriptionFile: 'description.md' }, 'Usage: test'),
    /not both/
  )
})

test('readCliTextFile requires an existing file', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-text-file-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'content.md')
  await fs.writeFile(file, '# Content\n', 'utf8')

  assert.equal(await readCliTextFile(file, 'content', 'Usage: test'), '# Content')
  await assert.rejects(readCliTextFile(undefined, 'content', 'Usage: test'), /Usage: test/)
  await assert.rejects(readCliTextFile(path.join(dir, 'missing.md'), 'content', 'Usage: test'), /content file/)
})
