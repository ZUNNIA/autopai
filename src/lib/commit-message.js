import { stripTypePrefix } from './util.js'

function comparable(value) {
  return stripTypePrefix(String(value ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Removes a commit body that only restates the subject. A body that adds any
 * concrete detail is preserved. Comparison ignores the conventional type
 * prefix, case, punctuation, and whitespace so "Gen panel context section."
 * is recognized as a duplicate of "refactor: gen panel context section".
 */
export function normalizeCommitMessage(message) {
  const text = String(message ?? '').replace(/\r\n/g, '\n').trim()
  const separator = text.indexOf('\n')
  if (separator < 0) return { message: text, changed: false }
  const subject = text.slice(0, separator).trim()
  const body = text.slice(separator + 1).trim()
  if (!subject || !body) return { message: text, changed: false }
  if (comparable(subject) === comparable(body)) {
    return { message: subject, changed: true }
  }
  return { message: text, changed: false }
}
