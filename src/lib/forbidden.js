const FORBIDDEN_PATHS = [
  /^\.github\//,
  /^AGENTS\.md$/,
  /^opencode\.jsonc?$/,
  /^\.autopilot\.json$/
]

export function findForbidden(files) {
  return (files ?? []).filter(file => FORBIDDEN_PATHS.some(pattern => pattern.test(file)))
}
