import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildChangelog, detectVersionManifest, updateChangelog, updateVersionManifest } from '../src/lib/release.js'

test('detects and updates a package.json manifest', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-release-json-'))
  await fs.writeFile(path.join(repo, 'package.json'), JSON.stringify({ name: 'demo', version: '1.2.3' }, null, 2), 'utf8')
  const manifest = await detectVersionManifest(repo)
  assert.equal(manifest.kind, 'json')
  assert.equal(manifest.relative, 'package.json')
  assert.equal(manifest.version, '1.2.3')
  await updateVersionManifest(manifest, '1.3.0')
  assert.equal(JSON.parse(await fs.readFile(manifest.file, 'utf8')).version, '1.3.0')
})

test('adds a version to a .NET project without one', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-release-dotnet-'))
  await fs.writeFile(path.join(repo, 'Demo.csproj'), '<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net10.0</TargetFramework>\n  </PropertyGroup>\n</Project>\n', 'utf8')
  const manifest = await detectVersionManifest(repo)
  assert.equal(manifest.kind, 'dotnet')
  await updateVersionManifest(manifest, '2.0.0')
  assert.match(await fs.readFile(manifest.file, 'utf8'), /<Version>2\.0\.0<\/Version>/)
})

test('builds a grouped changelog and removes local references', () => {
  const result = buildChangelog({
    version: '1.4.0',
    commits: [
      { subject: 'feat: add search' },
      { subject: 'fix: close panel #123' },
      { subject: 'refactor: split tickets/ready-for-dev/001-demo' },
      { subject: 'Merge branch main' }
    ]
  })
  assert.match(result.section, /### Added\n- add search/)
  assert.match(result.section, /### Fixed\n- close panel/)
  assert.match(result.section, /### Changed\n- split/)
  assert.doesNotMatch(result.section, /tickets\/ready-for-dev|#123|Merge branch/)
  assert.equal(result.entries, 3)
})

test('inserts or replaces the changelog section', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-release-changelog-'))
  await fs.writeFile(path.join(repo, 'CHANGELOG.md'), '# Changelog\n\n## [1.0.0] - 2026-01-01\n- old\n', 'utf8')
  await updateChangelog(repo, '1.1.0', [{ subject: 'feat: add search' }])
  let text = await fs.readFile(path.join(repo, 'CHANGELOG.md'), 'utf8')
  assert.match(text, /## \[1\.1\.0\]/)
  assert.match(text, /## \[1\.0\.0\]/)
  await updateChangelog(repo, '1.1.0', [{ subject: 'fix: repair search' }])
  text = await fs.readFile(path.join(repo, 'CHANGELOG.md'), 'utf8')
  assert.equal((text.match(/## \[1\.1\.0\]/g) ?? []).length, 1)
  assert.match(text, /repair search/)
})
