import { cleanBranches } from '../lib/branches.js'

export async function runBranches({ config, options, log }) {
  const action = String((options._ ?? [])[0] ?? '')
  const usage = 'Usage: autopai branches clean --repo <path> --branch <name> [--branch <name>] [--base <branch>] [--dry-run] --confirm'
  if (action !== 'clean') throw new Error(usage)

  const dryRun = options.dryRun === true
  const confirmed = options.confirm === true || options.yes === true
  if (!dryRun && !confirmed) {
    throw new Error('Deleting branches requires --confirm after explicit confirmation. Use --dry-run to preview.')
  }
  const branches = [].concat(options.branch ?? []).map(branch => String(branch).trim()).filter(Boolean)
  if (branches.length === 0) throw new Error('Specify at least one --branch <name>.')

  return cleanBranches({
    config,
    branches,
    base: options.base === undefined ? undefined : String(options.base),
    dryRun,
    log
  })
}
