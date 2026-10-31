const BILLING_PATTERNS = [
  /recent account payments have failed/i,
  /spending limit needs to be increased/i,
  /billing\s*(?:&|and)\s*plans/i,
  /payment[s]?\s+(?:have\s+)?failed/i
]

const INFRASTRUCTURE_PATTERNS = [
  /job was not started/i,
  /no (?:available )?runner/i,
  /runner.*(?:not available|unavailable|offline|capacity)/i,
  /resource not accessible by integration/i,
  /workflow.*permission/i,
  /could not resolve host/i,
  /service unavailable/i,
  /quota/i
]

function annotationText(annotation) {
  if (typeof annotation === 'string') return annotation.trim()
  return String(annotation?.message ?? annotation?.title ?? '').trim()
}

/**
 * Classifies GitHub Actions check annotations. Billing and runner failures are
 * infrastructure, not code failures: the job never produced a failure log that
 * an executor could repair. Billing is checked first because GitHub also labels
 * those notifications as "job was not started".
 */
export function classifyCheckAnnotations(annotations = []) {
  const messages = annotations.map(annotationText).filter(Boolean)
  const billing = messages.find(message => BILLING_PATTERNS.some(pattern => pattern.test(message)))
  if (billing) return { kind: 'billing', message: billing }
  const infrastructure = messages.find(message => INFRASTRUCTURE_PATTERNS.some(pattern => pattern.test(message)))
  if (infrastructure) return { kind: 'infrastructure', message: infrastructure }
  return { kind: 'unknown', message: messages[0] ?? null }
}

export function formatCheckAnnotations(annotations = []) {
  return annotations
    .map(annotation => {
      const message = annotationText(annotation)
      if (!message) return null
      const level = typeof annotation === 'string' ? 'failure' : String(annotation?.annotation_level ?? 'failure')
      return `${level}: ${message}`
    })
    .filter(Boolean)
    .join('\n')
}

export function isInfrastructureKind(kind) {
  return kind === 'billing' || kind === 'infrastructure'
}

export function checkRunIdFromLink(link) {
  const match = String(link ?? '').match(/\/job\/(\d+)/)
  return match ? match[1] : null
}
