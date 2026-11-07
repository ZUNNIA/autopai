import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from './git.js'
import { stripTypePrefix } from './util.js'

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

export async function prepareRelease({ config, version, log }) {
  if (!VERSION_PATTERN.test(String(version ?? ''))) {
    throw new Error('A semantic version in MAJOR.MINOR.PATCH format is required.')
  }

  const manifest = await detectVersionManifest(config.repoPath)
  const previousVersion = manifest.version
  await updateVersionManifest(manifest, version)

  const last = await git.lastTag(config.repoPath)
  const range = last ? `${last}..origin/${config.baseBranch}` : `origin/${config.baseBranch}`
  const commits = await git.logCommits(config.repoPath, range)
  const changelog = await updateChangelog(config.repoPath, version, commits, { lastTag: last })

  await git.add(config.repoPath, [manifest.relative, 'CHANGELOG.md'])
  const body = [
    `Update ${manifest.relative} and CHANGELOG.md for ${version}.`,
    `The release records ${changelog.entries} change(s) since ${last ?? 'the repository start'}.`,
    'Local gates and CI checks remain the release qualification.'
  ].join(' ')
  await git.commit(config.repoPath, `chore: release v${version}`, body)
  await log?.(`Prepared release v${version} from ${manifest.relative}.`)

  return {
    version,
    previousVersion,
    manifest: manifest.relative,
    changelog: 'CHANGELOG.md',
    commits: commits.length,
    entries: changelog.entries,
    lastTag: last
  }
}

export async function detectVersionManifest(repoPath) {
  const root = await fs.readdir(repoPath, { withFileTypes: true })
  const files = new Set(root.filter(entry => entry.isFile()).map(entry => entry.name))
  const directories = new Set(root.filter(entry => entry.isDirectory()).map(entry => entry.name))

  if (files.has('Directory.Build.props')) {
    return dotnetManifest(repoPath, 'Directory.Build.props')
  }
  const project = [...files].find(file => file.endsWith('.csproj'))
  if (project) return dotnetManifest(repoPath, project)
  if (files.has('package.json')) return jsonManifest(repoPath, 'package.json')
  if (files.has('pyproject.toml')) return tomlManifest(repoPath, 'pyproject.toml')
  if (files.has('Cargo.toml')) return tomlManifest(repoPath, 'Cargo.toml')
  if (files.has('VERSION')) return textManifest(repoPath, 'VERSION')
  if (directories.has('tickets')) {
    // Keep the error actionable for repositories without a conventional manifest.
    throw new Error('No supported version manifest found. Add package.json, pyproject.toml, Cargo.toml, a .csproj, Directory.Build.props, or VERSION.')
  }
  throw new Error('No supported version manifest found. Add package.json, pyproject.toml, Cargo.toml, a .csproj, Directory.Build.props, or VERSION.')
}

export async function updateVersionManifest(manifest, version) {
  const text = await fs.readFile(manifest.file, 'utf8')
  if (manifest.kind === 'json') {
    const parsed = JSON.parse(text)
    parsed.version = version
    await fs.writeFile(manifest.file, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
    return
  }

  if (manifest.kind === 'dotnet') {
    const versionTag = /<Version>[^<]*<\/Version>/i
    const prefixTag = /<VersionPrefix>[^<]*<\/VersionPrefix>/i
    let next
    if (versionTag.test(text)) next = text.replace(versionTag, `<Version>${version}</Version>`)
    else if (prefixTag.test(text)) next = text.replace(prefixTag, `<VersionPrefix>${version}</VersionPrefix>`)
    else {
      const propertyGroup = /<PropertyGroup[^>]*>/i
      const match = text.match(propertyGroup)
      if (match) {
        next = text.replace(propertyGroup, `${match[0]}\n    <Version>${version}</Version>`)
      } else {
        const closing = text.lastIndexOf('</Project>')
        if (closing < 0) throw new Error(`Could not find a PropertyGroup in ${manifest.relative}.`)
        next = `${text.slice(0, closing)}  <PropertyGroup>\n    <Version>${version}</Version>\n  </PropertyGroup>\n${text.slice(closing)}`
      }
    }
    await fs.writeFile(manifest.file, next, 'utf8')
    return
  }

  if (manifest.kind === 'toml') {
    const line = /^(\s*version\s*=\s*)(["'])[^"']*\2/gm
    if (!line.test(text)) throw new Error(`Could not find a version field in ${manifest.relative}.`)
    await fs.writeFile(manifest.file, text.replace(line, `$1"${version}"`), 'utf8')
    return
  }

  await fs.writeFile(manifest.file, `${version}\n`, 'utf8')
}

export async function updateChangelog(repoPath, version, commits, { lastTag = null } = {}) {
  const file = path.join(repoPath, 'CHANGELOG.md')
  const existing = await fs.readFile(file, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return ''
    throw error
  })
  const generated = buildChangelog({ version, commits, lastTag })
  const section = generated.section
  const heading = `## [${version}]`
  const existingHeading = new RegExp(`^${escapeRegExp(heading)}[^\\n]*\\n[\\s\\S]*?(?=^## \\[|$)`, 'm')
  let next
  if (existingHeading.test(existing)) {
    next = existing.replace(existingHeading, `${section}\n`)
  } else if (existing.trim() === '') {
    next = `# Changelog\n\n${section}\n`
  } else {
    const firstSection = existing.search(/^##\s+\[/m)
    if (firstSection >= 0) next = `${existing.slice(0, firstSection).trimEnd()}\n\n${section}\n\n${existing.slice(firstSection).trimStart()}`
    else next = `${existing.trimEnd()}\n\n${section}\n`
  }
  await fs.writeFile(file, `${next.trimEnd()}\n`, 'utf8')
  return { ...generated, file }
}

export function buildChangelog({ version, commits, lastTag = null }) {
  const groups = { Added: [], Fixed: [], Changed: [] }
  for (const commit of commits ?? []) {
    const subject = String(commit.subject ?? '').trim()
    if (!subject || /^Merge\b/i.test(subject)) continue
    const type = subject.split(':')[0].trim().toLowerCase()
    const entry = sanitizeEntry(stripTypePrefix(subject))
    if (!entry) continue
    if (type === 'feat') groups.Added.push(entry)
    else if (type === 'fix') groups.Fixed.push(entry)
    else groups.Changed.push(entry)
  }
  for (const key of Object.keys(groups)) groups[key] = [...new Set(groups[key])]

  const lines = [`## [${version}] - ${new Date().toISOString().slice(0, 10)}`]
  let entries = 0
  for (const [title, items] of Object.entries(groups)) {
    if (items.length === 0) continue
    lines.push('', `### ${title}`)
    for (const item of items) {
      lines.push(`- ${item}`)
      entries += 1
    }
  }
  if (entries === 0) {
    lines.push('', 'No user-facing changes were recorded.')
    if (!lastTag) lines.push('', 'This is the first recorded release.')
  }
  return { section: lines.join('\n'), entries }
}

function sanitizeEntry(value) {
  return String(value)
    .replace(/\btickets[\\/][^\s)]+/gi, '')
    .replace(/\bADR-\d+\b/gi, '')
    .replace(/(^|\s)#\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function jsonManifest(repoPath, relative) {
  const file = path.join(repoPath, relative)
  const text = await fs.readFile(file, 'utf8')
  const parsed = JSON.parse(text)
  if (typeof parsed.version !== 'string' || !parsed.version) throw new Error(`${relative} has no version field.`)
  return { kind: 'json', file, relative, version: parsed.version }
}

async function dotnetManifest(repoPath, relative) {
  const file = path.join(repoPath, relative)
  const text = await fs.readFile(file, 'utf8')
  const version = text.match(/<Version>([^<]*)<\/Version>/i)?.[1]
    ?? text.match(/<VersionPrefix>([^<]*)<\/VersionPrefix>/i)?.[1]
    ?? null
  return { kind: 'dotnet', file, relative, version }
}

async function tomlManifest(repoPath, relative) {
  const file = path.join(repoPath, relative)
  const text = await fs.readFile(file, 'utf8')
  const version = text.match(/^\s*version\s*=\s*["']([^"']+)["']/m)?.[1] ?? null
  if (!version) throw new Error(`${relative} has no version field.`)
  return { kind: 'toml', file, relative, version }
}

async function textManifest(repoPath, relative) {
  const file = path.join(repoPath, relative)
  const version = (await fs.readFile(file, 'utf8')).trim()
  if (!version) throw new Error(`${relative} is empty.`)
  return { kind: 'text', file, relative, version }
}
