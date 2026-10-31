import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readBillingIndicator, validateBillingFiles, validateBillingText } from '../src/lib/billing.js'

const section = [
  '## Billing impact',
  '- **Estimate:** USD 0.02-0.05 per 1,000 requests',
  '- **Drivers:** provider API and CI tests',
  '- **Assumptions:** 10,000 requests per month',
  '- **Confidence:** medium'
].join('\n')

test('accepts a ticket with no billing increase and no section', () => {
  const text = ['---', 'id: example', 'billing: none', '---', '', '# Example'].join('\n')
  assert.equal(readBillingIndicator(text), 'none')
  assert.deepEqual(validateBillingText(text, { file: 'example.md' }), {
    file: 'example.md',
    billing: 'none',
    estimate: null
  })
})

test('requires an estimate section for increase and unknown', () => {
  const increased = ['---', 'id: example', 'billing: increase', '---', '', '# Example', '', section].join('\n')
  const report = validateBillingText(increased, { file: 'example.md' })
  assert.equal(report.billing, 'increase')
  assert.match(report.estimate, /USD/)

  assert.throws(
    () => validateBillingText(['---', 'billing: increase', '---', '', '# Example'].join('\n'), { file: 'missing.md' }),
    /Billing impact section/
  )
  assert.throws(
    () => validateBillingText(['Billing impact: unknown', '', '# Example'].join('\n'), { file: 'unknown.md' }),
    /Billing impact section/
  )
})

test('accepts a document indicator and an Unknown estimate', () => {
  const text = ['Billing impact: unknown', '', '# Finding', '', '## Billing impact', '- **Estimate:** Unknown'].join('\n')
  const report = validateBillingText(text, { file: 'finding.md' })
  assert.equal(report.billing, 'unknown')
  assert.equal(report.estimate, 'Unknown')
})

test('rejects a missing or invalid indicator', () => {
  assert.throws(() => validateBillingText('# Ticket', { file: 'missing.md' }), /mandatory billing indicator/)
  assert.throws(
    () => validateBillingText(['---', 'billing: sometimes', '---'].join('\n'), { file: 'invalid.md' }),
    /invalid billing value/
  )
})

test('validates files and reports only increase or unknown', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-billing-'))
  const none = path.join(dir, 'none.md')
  const unknown = path.join(dir, 'unknown.md')
  await fs.writeFile(none, ['---', 'billing: none', '---'].join('\n'), 'utf8')
  await fs.writeFile(unknown, ['---', 'billing: unknown', '---', '', section].join('\n'), 'utf8')

  const reports = await validateBillingFiles([none, unknown])
  assert.equal(reports.length, 1)
  assert.equal(reports[0].billing, 'unknown')
})
