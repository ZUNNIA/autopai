import path from 'node:path'
import { validateArtifactFiles } from './artifact-contracts.js'
import { walkFiles } from './util.js'

const DIRS = [
  { configKey: 'readyForDev', kind: 'ready-for-dev' },
  { configKey: 'identified', kind: 'identified' },
  { configKey: 'readyForRefactor', kind: 'ready-for-refactor' },
  { configKey: 'ux', kind: 'ux' }
]

export async function checkArtifacts(config) {
  const checks = []
  const backlogRoot = path.join(config.repoPath, config.ticketDirs.backlog)
  const backlogFiles = await walkFiles(backlogRoot, file => file.endsWith('.md'))
  const briefs = backlogFiles.filter(file => path.basename(file) === 'brief.md')
  const backlogs = backlogFiles.filter(file => path.basename(file) === 'backlog.md')
  await collect(checks, briefs, 'brief')
  await collect(checks, backlogs, 'backlog')

  for (const { configKey, kind } of DIRS) {
    const root = path.join(config.repoPath, config.ticketDirs[configKey])
    await collect(checks, await walkFiles(root, file => file.endsWith('.md')), kind)
  }

  return {
    ok: checks.every(check => check.ok),
    checked: checks.length,
    failed: checks.filter(check => !check.ok).length,
    checks
  }
}

async function collect(checks, files, kind) {
  for (const file of files) {
    try {
      const [report] = await validateArtifactFiles([file], kind)
      checks.push({ file, kind, ok: true, errors: [], report })
    } catch (error) {
      checks.push({ file, kind, ok: false, errors: [error.message] })
    }
  }
}
