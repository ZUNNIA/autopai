import { slugify } from './util.js'

/**
 * Packs repository-relative code files into bounded directory chunks. Files of
 * one top-level tree stay together, oversized directories split into
 * consecutive slices, and each chunk carries a descriptive, unique name.
 */
export function chunkCodeFiles(files, maxFiles) {
  const limit = Math.max(1, Math.floor(Number(maxFiles)) || 1)
  const groups = new Map()
  for (const file of [...files].sort()) {
    const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir).push(file)
  }

  const chunks = []
  let current = { root: null, dirs: [], files: [] }
  const flush = () => {
    if (current.files.length === 0) return
    chunks.push({ dirs: current.dirs, files: current.files })
    current = { root: null, dirs: [], files: [] }
  }

  for (const [dir, groupFiles] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const root = dir.split('/')[0]
    if (current.files.length > 0 && root !== current.root) flush()
    current.root = root

    if (groupFiles.length > limit) {
      flush()
      for (let index = 0; index < groupFiles.length; index += limit) {
        chunks.push({ dirs: [dir], files: groupFiles.slice(index, index + limit) })
      }
      continue
    }

    if (current.files.length + groupFiles.length > limit) flush()
    current.root = root
    current.dirs.push(dir)
    current.files.push(...groupFiles)
  }
  flush()

  const used = new Set()
  return chunks.map(chunk => {
    const label = slugify(chunkLabel(chunk.dirs)) || 'root'
    let name = label
    let suffix = 2
    while (used.has(name)) name = `${label}-${suffix++}`
    used.add(name)
    return { name, files: chunk.files }
  })
}

function chunkLabel(dirs) {
  const candidates = dirs.filter(Boolean)
  if (candidates.length === 0) return 'root'
  const segments = candidates.map(dir => dir.split('/'))
  const common = []
  for (let index = 0; index < segments[0].length; index += 1) {
    const segment = segments[0][index]
    if (segments.every(parts => parts[index] === segment)) common.push(segment)
    else break
  }
  return common.length > 0 ? common.join('-') : candidates[0]
}
