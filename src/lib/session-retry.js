const TRANSIENT_SESSION_ERROR = /ttft_admission_refused|cell is at capacity|retry shortly/i

/**
 * True when a failed coding-tool session is a provider-capacity error that is
 * safe to retry once. Generic failures are never retried automatically.
 */
export function shouldRetrySession(result) {
  if (!result || result.code === 0) return false
  return TRANSIENT_SESSION_ERROR.test(`${result.stderr ?? ''}\n${result.stdout ?? ''}`)
}

/**
 * Uses the provider's suggested retry delay when present, with a one-second
 * margin. The value is bounded so a malformed provider message cannot stall a
 * run indefinitely.
 */
export function sessionRetryDelayMs(result, fallbackMs = 20000) {
  const text = `${result?.stderr ?? ''}\n${result?.stdout ?? ''}`
  const match = text.match(/after\s+(\d+)\s*s/i)
  if (!match) return fallbackMs
  const seconds = Number(match[1])
  if (!Number.isFinite(seconds)) return fallbackMs
  return Math.max(1000, Math.min(120000, seconds * 1000 + 1000))
}
