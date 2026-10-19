import fs from 'node:fs/promises'
import path from 'node:path'
import { slugify } from './util.js'

/**
 * Resolves phase arguments when the caller omits them. Explicit options always
 * win; otherwise the previous run state and the existing ticket directories are
 * inspected. The resolver never guesses when no candidate exists: it fails with
 * the option the user must pass.
 */

export function featureFromDescription(description) {
  const slug = slugify(description ?? '')
  return slug || null
}

export async function resolveFeature({ config, options, state, dirs }) {
  const explicit = String(options?.feature ?? '').trim()
  if (explicit) return explicit

  const fromState = String(state?.feature ?? '').trim()
  if (fromState && await featureDirExists(config, dirs, fromState)) return fromState

  const latest = await latestFeatureDir(config, dirs)
  if (latest) return latest

  throw new Error('Could not resolve --feature: no ticket directory was found. Pass --feature <slug> explicitly.')
}

export async function latestFeatureDir(config, dirs) {
  const candidates = []
  for (const dir of dirs) {
    const root = path.join(config.repoPath, dir)
    let entries
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const stat = await fs.stat(path.join(root, entry.name))
      candidates.push({ name: entry.name, mtime: stat.mtimeMs })
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((left, right) => right.mtime - left.mtime || left.name.localeCompare(right.name))
  return candidates[0].name
}

/**
 * Derives audit scopes from the previous run state so identify can run without
 * arguments after a dev, refactor, adopt, or identify run.
 */
export function scopesFromState(state) {
  if (!state) return []
  const modes = new Set(['dev', 'refactor', 'adopt', 'identify'])
  if (!modes.has(state.mode)) return []
  const scopes = []
  if (state.prNumber) scopes.push(`pr:${state.prNumber}`)
  for (const scope of state.scopes ?? []) {
    if (scope.prNumber) scopes.push(`pr:${scope.prNumber}`)
    else if (scope.kind === 'pr' && /^pr-\d+$/.test(String(scope.name))) scopes.push(`pr:${String(scope.name).slice(3)}`)
  }
  return [...new Set(scopes)]
}

/**
 * Turns merged pull requests into audit scopes, most recent first. The Git host
 * lists by creation date, so the caller fetches a wider window than it needs.
 */
export function lastMergedScopes(prs, count) {
  const ordered = [...(prs ?? [])]
    .filter(pr => pr && pr.number != null)
    .sort((left, right) => String(right.mergedAt ?? '').localeCompare(String(left.mergedAt ?? '')))
  return ordered.slice(0, count).map(pr => `pr:${pr.number}`)
}

async function featureDirExists(config, dirs, feature) {
  for (const dir of dirs) {
    try {
      const stat = await fs.stat(path.join(config.repoPath, dir, feature))
      if (stat.isDirectory()) return true
    } catch {
      // The feature directory does not exist under this root.
    }
  }
  return false
}
