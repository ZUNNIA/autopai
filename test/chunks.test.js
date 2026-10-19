import test from 'node:test'
import assert from 'node:assert/strict'
import { chunkCodeFiles } from '../src/lib/chunks.js'

test('packs directories into bounded chunks per top-level tree', () => {
  const chunks = chunkCodeFiles([
    'Services/A.cs',
    'Services/Sub/B.cs',
    'ViewModels/C.cs',
    'Program.cs'
  ], 2)

  assert.deepEqual(chunks.map(chunk => chunk.files), [
    ['Program.cs'],
    ['Services/A.cs', 'Services/Sub/B.cs'],
    ['ViewModels/C.cs']
  ])
  assert.deepEqual(chunks.map(chunk => chunk.name), ['root', 'services', 'viewmodels'])
})

test('splits an oversized directory into consecutive slices with unique names', () => {
  const files = Array.from({ length: 5 }, (_, index) => `Services/File${index + 1}.cs`)
  const chunks = chunkCodeFiles(files, 2)
  assert.deepEqual(chunks.map(chunk => chunk.files.length), [2, 2, 1])
  assert.equal(new Set(chunks.map(chunk => chunk.name)).size, chunks.length)
  assert.deepEqual(chunks.flatMap(chunk => chunk.files), files)
})

test('never exceeds the limit and stays deterministic', () => {
  const files = ['Models/A.cs', 'Models/B.cs', 'Services/C.cs', 'Services/D.cs', 'Utils/E.cs']
  const first = chunkCodeFiles(files, 3)
  const second = chunkCodeFiles([...files].reverse(), 3)
  assert.deepEqual(first, second)
  assert.ok(first.every(chunk => chunk.files.length <= 3))
  assert.deepEqual([...new Set(first.flatMap(chunk => chunk.files))].sort(), [...files].sort())
})
