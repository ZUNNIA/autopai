import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureDir, exists, slugify, walkFiles } from './util.js'

const STATUSES = ['Proposed', 'Accepted', 'Deprecated', 'Superseded']

export async function resolveAdrDirectory(repoPath) {
  const tickets = path.join(repoPath, 'tickets', 'adr')
  const docs = path.join(repoPath, 'docs', 'adr')
  if (await exists(tickets)) return tickets
  if (await exists(docs)) return docs
  return tickets
}

export async function nextAdrNumber(dir) {
  let maximum = 0
  for (const file of await walkFiles(dir, file => file.endsWith('.md'))) {
    const match = path.basename(file).match(/^(\d+)-/)
    if (match) maximum = Math.max(maximum, Number(match[1]))
  }
  return maximum + 1
}

export async function createAdr({ repoPath, title, status = 'Proposed', content = null }) {
  const name = String(title ?? '').trim()
  if (!name) throw new Error('An ADR title is required.')
  if (!STATUSES.includes(status)) throw new Error(`ADR status must be one of: ${STATUSES.join(', ')}.`)

  const dir = await resolveAdrDirectory(repoPath)
  await ensureDir(dir)
  const number = String(await nextAdrNumber(dir)).padStart(3, '0')
  const slug = slugify(name)
  const file = path.join(dir, `${number}-${slug}.md`)
  if (await exists(file)) throw new Error(`ADR already exists: ${file}`)
  const text = content === null || content === undefined
    ? renderAdrTemplate({ number, title: name, status })
    : renderAdrContent({ content, number, title: name, status })
  await fs.writeFile(file, text, 'utf8')
  return { file, number, title: name, status }
}

export function renderAdrContent({ content, number, title, status }) {
  const text = String(content ?? '')
    .replaceAll('{{number}}', () => number)
    .replaceAll('{{title}}', () => title)
    .replaceAll('{{status}}', () => status)
    .trim()
  if (!text) throw new Error('The ADR content file is empty.')
  for (const section of ['1', '2', '3', '4', '5']) {
    if (!new RegExp(`^##\\s+${section}\\.\\s+\\S+`, 'm').test(text)) {
      throw new Error(`The ADR content must include section ${section}.`)
    }
  }
  const heading = `# ${number}: ${title}`
  if (text.startsWith('# ')) {
    if (!text.startsWith(`${heading}\n`) && !text.startsWith(`${heading}\r\n`)) {
      throw new Error(`The ADR content heading must be "${heading}".`)
    }
    return `${text}\n`
  }
  return `${heading}\n\n${text}\n`
}

export function renderAdrTemplate({ number, title, status }) {
  return `# ${number}: ${title}

## 1. Title, Status & Category

- **Title:** ${number}: ${title}
- **Status:** ${status}
- **Category:** Architecture
- **Justification:** Pending.

## 2. Context

Describe the problem, constraints, and forces that require a decision.

## 3. Options Considered

### Option A: Pending

Describe the option, its pros, and its cons.

### Option B: Pending

Describe the option, its pros, and its cons.

## 4. Decision

Record the chosen option and why it beats the alternatives.

## 5. Consequences

Describe the positive impact, negative impact, risks, and follow-up actions.
`
}

export function adrStatuses() {
  return [...STATUSES]
}
