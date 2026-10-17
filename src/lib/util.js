import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Replaces ${NAME} tokens using the current process environment.
 */
export function expandEnv(value) {
  if (Array.isArray(value)) return value.map(expandEnv)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandEnv(item)]))
  }
  if (typeof value !== 'string') return value
  return value.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] ?? '')
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

export async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

export async function atomicWriteJson(file, value) {
  await ensureDir(path.dirname(file))
  const temp = `${file}.${process.pid}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temp, file)
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

export async function walkFiles(dir, predicate) {
  const found = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return found
    throw error
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...await walkFiles(full, predicate))
    else if (entry.isFile() && predicate(full)) found.push(full)
  }
  return found
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function parseCliArgs(argv) {
  const [command = 'help', ...rest] = argv
  const options = { _: [] }
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (!arg.startsWith('--')) {
      options._.push(arg)
      continue
    }
    const equals = arg.indexOf('=')
    const rawKey = equals >= 0 ? arg.slice(2, equals) : arg.slice(2)
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    let value = equals >= 0 ? arg.slice(equals + 1) : undefined
    if (value === undefined) {
      if (rest[index + 1] && !rest[index + 1].startsWith('--')) value = rest[++index]
      else value = true
    }
    if (key === 'scope') options.scope = options.scope ? [].concat(options.scope, value) : [value]
    else options[key] = value
  }
  return { command, options }
}

export function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function stripTypePrefix(subject) {
  return String(subject).replace(/^(feat|fix|refactor|perf|test|docs|chore):\s*/i, '')
}

export function truncate(value, limit = 12000) {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit)}\n... truncated ...` : text
}
