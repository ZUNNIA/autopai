import fs from 'node:fs/promises'

export const BILLING_VALUES = ['none', 'increase', 'unknown']

function frontMatter(text) {
  const match = String(text ?? '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  return match ? match[1] : ''
}

export function readBillingIndicator(text) {
  const meta = frontMatter(text)
  const fromMeta = meta.match(/^billing:\s*(.+?)\s*$/im)
  const fromDocument = String(text ?? '').match(/^Billing impact:\s*(.+?)\s*$/im)
  const raw = (fromMeta?.[1] ?? fromDocument?.[1] ?? '').trim().toLowerCase()
  return raw || null
}

export function hasBillingSection(text) {
  return /^##\s+Billing impact\s*$/im.test(String(text ?? ''))
}

export function readBillingEstimate(text) {
  const match = String(text ?? '').match(/^\s*[-*]\s+(?:\*\*)?Estimate:(?:\*\*)?\s*(.+?)\s*$/im)
  return match ? match[1].trim() : null
}

/**
 * Every generated artifact declares whether billing increases. The detailed
 * report exists only for increase or unknown; none is a deliberate no-op.
 */
export function validateBillingText(text, { file = '<memory>' } = {}) {
  const billing = readBillingIndicator(text)
  if (!billing) {
    throw new Error(`${file}: missing mandatory billing indicator. Use billing: none|increase|unknown or Billing impact: none|increase|unknown.`)
  }
  if (!BILLING_VALUES.includes(billing)) {
    throw new Error(`${file}: invalid billing value "${billing}". Use none, increase, or unknown.`)
  }
  if (billing === 'none') return { file, billing, estimate: null }

  if (!hasBillingSection(text)) {
    throw new Error(`${file}: billing is ${billing}, so a ## Billing impact section with an Estimate is required.`)
  }
  const estimate = readBillingEstimate(text)
  if (!estimate) {
    throw new Error(`${file}: the Billing impact section must include an Estimate line.`)
  }
  return { file, billing, estimate }
}

export async function validateBillingFiles(files, options = {}) {
  const reports = []
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8')
    const report = validateBillingText(text, { file, ...options })
    if (report.billing !== 'none') reports.push(report)
  }
  return reports
}
