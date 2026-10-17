import fs from 'node:fs/promises'
import path from 'node:path'
import { walkFiles } from './util.js'

/**
 * Reads every Cobertura report under TestResults and returns the aggregate
 * line coverage. Returns null when no report exists.
 */
export async function readCoverage(repoPath) {
  const reports = await walkFiles(
    path.join(repoPath, 'TestResults'),
    file => file.endsWith('coverage.cobertura.xml')
  )
  if (reports.length === 0) return null

  let covered = 0
  let valid = 0
  for (const report of reports) {
    const xml = await fs.readFile(report, 'utf8')
    covered += sumAttribute(xml, 'lines-covered')
    valid += sumAttribute(xml, 'lines-valid')
  }
  if (valid === 0) return null
  return { covered, valid, rate: covered / valid, reports }
}

function sumAttribute(xml, attribute) {
  const matches = xml.match(new RegExp(`${attribute}="(\\d+)"`, 'g')) ?? []
  return matches.reduce((total, item) => total + Number(item.match(/="(\d+)"/)[1]), 0)
}

export function formatCoverage(coverage) {
  if (!coverage) return 'no coverage report'
  return `${(coverage.rate * 100).toFixed(2)}% (${coverage.covered}/${coverage.valid} lines)`
}
