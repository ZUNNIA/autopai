const RUNNERS = {
  opencode: () => import('./opencode.js')
}

/**
 * Resolves the session runner declared in `.autopilot.json`. Adding support
 * for another coding tool means adding one module here and one entry to the
 * map; the core never imports a concrete runner.
 */
export async function resolveRunner(config) {
  const name = config.runner ?? 'opencode'
  const loader = RUNNERS[name]
  if (!loader) {
    throw new Error(`Unknown runner "${name}". Available runners: ${availableRunners().join(', ')}.`)
  }
  return loader()
}

export function availableRunners() {
  return Object.keys(RUNNERS)
}
