import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_POLICY_FILE_BYTES = 5 * 1024 * 1024
const TYPES = 'feat|fix|refactor|perf|test|docs|chore'
const SUBJECT_RE = new RegExp(`^(${TYPES}): [^\\s].+$`)
const SCOPED_RE = new RegExp(`^(${TYPES})\\([^)]*\\):`)
const BRANCH_RE = new RegExp(`^(${TYPES})/[a-z0-9]+(?:-[a-z0-9]+)*$`)
const TICKET_CODE_RE = /\btickets[\\/]/i
const ADR_CODE_RE = /\bADR-\d+\b/i
const TICKET_MESSAGE_RE = /\btickets[\\/]|TICKET-\d+|ticket\s*#\d+/i
const ADR_MESSAGE_RE = /\bADR-\d+\b/i
const ISSUE_REF_RE = /(^|\s)#\d+\b/
const LIST_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+/m

/**
 * Validates a branch name against the configured convention and rejects
 * ticket identifiers in the ref.
 */
export function validateBranchName(branch) {
  const violations = []
  if (!branch) {
    violations.push({ code: 'branch-empty', message: 'Branch name is empty.' })
    return violations
  }
  if (!BRANCH_RE.test(branch)) {
    violations.push({ code: 'branch-format', message: `Branch "${branch}" must match <type>/<kebab-case-slug> using ${TYPES}.` })
  }
  if (branch.split('/').some(segment => /^\d+$/.test(segment))) {
    violations.push({ code: 'branch-ticket-id', message: `Branch "${branch}" contains a numeric ticket-like segment.` })
  }
  if (/ticket|TICKET|#/.test(branch)) {
    violations.push({ code: 'branch-ticket-ref', message: `Branch "${branch}" contains a ticket reference.` })
  }
  if (ADR_CODE_RE.test(branch)) {
    violations.push({ code: 'branch-adr-ref', message: `Branch "${branch}" contains an ADR reference.` })
  }
  return violations
}

/**
 * Validates a commit subject and body. Scopes and ticket/ADR references are
 * forbidden because the orchestrator must keep Git artifacts independent from
 * local work items.
 */
export function validateCommitMessage(message) {
  const violations = []
  const text = String(message ?? '').trim()
  if (!text) {
    violations.push({ code: 'commit-empty', message: 'Commit message is empty.' })
    return violations
  }
  const [subject, ...bodyLines] = text.split(/\r?\n/)
  if (SCOPED_RE.test(subject)) {
    violations.push({ code: 'commit-scope', message: `Commit subject "${subject}" uses a scope. Use "${subject.replace(SCOPED_RE, '$1')}: ..." instead.` })
  }
  if (!SUBJECT_RE.test(subject)) {
    violations.push({ code: 'commit-format', message: `Commit subject "${subject}" must match "<type>: <subject>".` })
  }
  if (TICKET_MESSAGE_RE.test(text)) {
    violations.push({ code: 'commit-ticket-ref', message: 'Commit message contains a ticket reference.' })
  }
  if (ADR_MESSAGE_RE.test(text)) {
    violations.push({ code: 'commit-adr-ref', message: 'Commit message contains an ADR reference.' })
  }
  if (ISSUE_REF_RE.test(text)) {
    violations.push({ code: 'commit-issue-ref', message: 'Commit message contains an issue-like reference (#123).' })
  }
  if (bodyLines.some(line => /^Merge pull request /.test(line))) {
    violations.push({ code: 'commit-merge-default', message: 'Commit message uses the GitHub default merge subject.' })
  }
  return violations
}

export function validatePrTitle(title) {
  const violations = []
  const text = String(title ?? '').trim()
  if (!SUBJECT_RE.test(text)) {
    violations.push({ code: 'pr-title-format', message: `PR title "${text}" must match "<type>: <subject>".` })
  }
  if (SCOPED_RE.test(text)) {
    violations.push({ code: 'pr-title-scope', message: `PR title "${text}" uses a scope.` })
  }
  if (TICKET_MESSAGE_RE.test(text)) {
    violations.push({ code: 'pr-title-ticket-ref', message: 'PR title contains a ticket reference.' })
  }
  if (ADR_MESSAGE_RE.test(text)) {
    violations.push({ code: 'pr-title-adr-ref', message: 'PR title contains an ADR reference.' })
  }
  if (ISSUE_REF_RE.test(text)) {
    violations.push({ code: 'pr-title-issue-ref', message: 'PR title contains an issue-like reference.' })
  }
  return violations
}

export function validatePrBody(body) {
  const violations = []
  const text = String(body ?? '')
  if (TICKET_MESSAGE_RE.test(text)) {
    violations.push({ code: 'pr-body-ticket-ref', message: 'PR body contains a ticket reference.' })
  }
  if (ADR_MESSAGE_RE.test(text)) {
    violations.push({ code: 'pr-body-adr-ref', message: 'PR body contains an ADR reference.' })
  }
  if (ISSUE_REF_RE.test(text)) {
    violations.push({ code: 'pr-body-issue-ref', message: 'PR body contains an issue-like reference.' })
  }
  if (LIST_LINE_RE.test(text)) {
    violations.push({ code: 'pr-body-list', message: 'PR body must use prose; bullet and numbered lists are forbidden.' })
  }
  return violations
}

/**
 * Scans added diff lines for references that must never reach source code.
 * Issue-style #123 references are intentionally checked only in commit and PR
 * text, because color literals such as #0AFFFFFF are valid in XAML and CSS.
 */
export function scanAddedLines(diff) {
  const violations = []
  const lines = String(diff ?? '').split(/\r?\n/)
  let currentFile = null
  let newLine = 0
  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      currentFile = line.slice(4).replace(/^b\//, '')
      continue
    }
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/)
      newLine = match ? Number(match[1]) : 0
      continue
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const added = line.slice(1)
      if (TICKET_CODE_RE.test(added)) {
        violations.push({ code: 'code-ticket-ref', file: currentFile, line: newLine, message: `Added code contains a ticket path: ${added.trim()}` })
      }
      if (ADR_CODE_RE.test(added)) {
        violations.push({ code: 'code-adr-ref', file: currentFile, line: newLine, message: `Added code contains an ADR reference: ${added.trim()}` })
      }
      newLine += 1
    } else if (!line.startsWith('-')) {
      newLine += 1
    }
  }
  return violations
}

export function scanBranch({ branch, commits, diff }) {
  const violations = [...validateBranchName(branch)]
  for (const commit of commits ?? []) {
    violations.push(...validateCommitMessage(commit.message ?? commit.subject ?? ''))
  }
  violations.push(...scanAddedLines(diff))
  return violations
}

export function formatViolations(violations) {
  return violations.map(item => {
    const location = item.file ? `${item.file}${item.line ? `:${item.line}` : ''}` : ''
    return `${location ? `${location} ` : ''}[${item.code}] ${item.message}`
  }).join('\n')
}

function decodePolicyText(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le')
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2))
    swapped.swap16()
    return swapped.toString('utf16le')
  }
  if (buffer.includes(0)) return null
  return buffer.toString('utf8')
}

/**
 * Scans the current content of every changed text file. The Git artifact policy
 * forbids ticket and ADR references in code even when they predate the branch,
 * so fixing the files the branch already touches is part of adoption. Binary
 * files and files larger than the safety limit are skipped.
 */
export async function scanRepositoryFiles(repoPath, files) {
  const violations = []
  for (const file of files ?? []) {
    const full = path.join(repoPath, file)
    let text
    try {
      const stat = await fs.stat(full)
      if (!stat.isFile() || stat.size > MAX_POLICY_FILE_BYTES) continue
      const buffer = await fs.readFile(full)
      text = decodePolicyText(buffer)
      if (text == null) continue
    } catch {
      continue
    }
    text.split(/\r?\n/).forEach((line, index) => {
      if (TICKET_CODE_RE.test(line)) {
        violations.push({ code: 'file-ticket-ref', file, line: index + 1, message: `Code contains a ticket path: ${line.trim()}` })
      }
      if (ADR_CODE_RE.test(line)) {
        violations.push({ code: 'file-adr-ref', file, line: index + 1, message: `Code contains an ADR reference: ${line.trim()}` })
      }
    })
  }
  return violations
}
