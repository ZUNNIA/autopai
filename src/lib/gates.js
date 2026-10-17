import { runCommand } from './runner.js'
import { readCoverage, formatCoverage } from './coverage.js'

/**
 * Runs restore, build, test, and coverage locally. The GitHub workflow remains
 * the final authority; these gates catch failures before a push.
 */
export async function runGates({ config, artifacts, prefix = 'gate' }) {
  const steps = [
    ['restore', config.restoreCommand],
    ['build', config.buildCommand],
    ['test', config.testCommand]
  ].filter(([, command]) => Array.isArray(command) && command.length > 0)

  const results = []
  for (const [name, command] of steps) {
    const [executable, ...args] = command
    const result = await runCommand(executable, args, {
      cwd: config.repoPath,
      timeoutMs: config.commandTimeoutMinutes * 60000,
      logFile: artifacts.path(`${prefix}-${name}.log`)
    })
    results.push({ name, ...result })
    if (result.code !== 0) {
      return { ok: false, results, failed: name, reason: `${name} failed with exit code ${result.code}.` }
    }
  }

  const coverage = await readCoverage(config.repoPath)
  if (config.coverageThreshold != null) {
    if (!coverage) {
      return { ok: false, results, failed: 'coverage', reason: 'No Cobertura coverage report was produced.' }
    }
    if (coverage.rate < config.coverageThreshold) {
      return {
        ok: false,
        results,
        coverage,
        failed: 'coverage',
        reason: `Coverage ${formatCoverage(coverage)} is below the configured minimum ${(config.coverageThreshold * 100).toFixed(2)}%.`
      }
    }
  }

  return { ok: true, results, coverage }
}

export function gateFailureText(result) {
  const failed = result.results?.find(item => item.name === result.failed)
  const output = failed ? `${failed.stdout}\n${failed.stderr}` : ''
  return `${result.reason}\n\n${output}`.trim()
}
