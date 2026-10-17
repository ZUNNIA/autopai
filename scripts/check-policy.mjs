import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const ignoredDirectories = new Set(['node_modules', '.git'])
const ignoredFiles = new Set(['package-lock.json', 'scripts/check-policy.mjs'])

const patterns = [
  { name: 'github token', regex: /gh[opsu]_[A-Za-z0-9_]{20,}/ },
  { name: 'github fine-grained token', regex: /github_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'openai key', regex: /sk-[A-Za-z0-9]{20,}/ },
  { name: 'tavily key', regex: /tvly-[A-Za-z0-9-]{10,}/ },
  { name: 'aws access key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'private key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'windows user path', regex: /C:\\Users\\[^\\\s]+/i },
  { name: 'unix user path', regex: /\/Users\/[A-Za-z0-9._-]+\// }
]

async function main() {
  const violations = []
  for (const file of await walk(root)) {
    const relative = path.relative(root, file).replace(/\\/g, '/')
    if (ignoredFiles.has(relative)) continue
    const text = await fs.readFile(file, 'utf8').catch(() => null)
    if (text === null) continue
    for (const pattern of patterns) {
      if (pattern.regex.test(text)) violations.push(`${relative}: ${pattern.name}`)
    }
  }

  if (violations.length > 0) {
    process.stderr.write(`Policy violations:\n${violations.join('\n')}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write('Policy check passed.\n')
}

async function walk(directory) {
  const found = []
  const entries = await fs.readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue
      found.push(...await walk(path.join(directory, entry.name)))
    } else if (entry.isFile()) {
      found.push(path.join(directory, entry.name))
    }
  }
  return found
}

main().catch(error => {
  process.stderr.write(`check-policy: ${error.message}\n`)
  process.exitCode = 1
})
