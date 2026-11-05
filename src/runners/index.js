const RUNNERS = {
  opencode: () => import('./opencode.js'),
  command: () => import('./command.js')
}

/**
 * Resolves the session runner declared in `autopai.json`. The generic command
 * runner covers most CLIs; a custom module is for protocols argv templates
 * cannot express. The core never imports a concrete runner.
 */
export async function resolveRunner(config) {
  const name = config.runner
  if (!name) {
    throw new Error(`runner is required in autopai.json. Available runners: ${availableRunners().join(', ')}.`)
  }
  const loader = RUNNERS[name]
  if (!loader) {
    throw new Error(`Unknown runner "${name}". Available runners: ${availableRunners().join(', ')}.`)
  }
  return loader()
}

export function availableRunners() {
  return Object.keys(RUNNERS)
}
