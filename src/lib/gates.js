import { runCommand } from './runner.js'
import { readCoverage, formatCoverage } from './coverage.js'

/**
 * Runs restore, build, test, smoke, and coverage locally. A failed attempt is
 * retried up to `retries` times so a transient test failure does not stop an
 * otherwise green ticket. The GitHub workflow remains the final authority.
 */
export async function runGates({ config, artifacts, prefix = 'gate', retries = 0 }) {
  const attempts = Math.max(0, Number(retries) || 0) + 1
  let result
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const attemptPrefix = attempt === 0 ? prefix : `${prefix}-retry-${attempt}`
    result = await runGatesOnce({ config, artifacts, prefix: attemptPrefix })
    if (result.ok) return { ...result, attempts: attempt + 1 }
  }
  return { ...result, attempts }
}

async function runGatesOnce({ config, artifacts, prefix }) {
  const steps = [
    ['restore', config.restoreCommand],
    ['build', config.buildCommand],
    ['test', config.testCommand],
    ['smoke', config.smokeCommand]
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
