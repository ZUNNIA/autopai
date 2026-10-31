import fs from 'node:fs/promises'
import path from 'node:path'
import { availableRunners } from '../runners/index.js'
import { GATES } from './pauses.js'
import {
  AGENT_KEYS,
  DEFAULT_AGENTS,
  DEFAULT_MODELS,
  DEFAULT_TICKET_DIRS,
  DEFAULTS,
  DEPRECATED_FIELDS,
  MODEL_KEYS,
  REQUIRED_KEYS,
  TICKET_DIR_KEYS,
  TOP_LEVEL_KEYS
} from './config-schema.js'
import { exists } from './util.js'

const INTEGER_FIELDS = {
  auditChunkFiles: { min: 1, label: 'a positive integer' },
  localGateRetries: { min: 0, label: 'a non-negative integer' },
  maxAttempts: { min: 1, label: 'a positive integer' },
  maxMinutes: { min: 1, label: 'a positive integer' },
  commandTimeoutMinutes: { min: 1, label: 'a positive integer' },
  sessionTimeoutMinutes: { min: 1, label: 'a positive integer' },
  checkPollSeconds: { min: 1, label: 'a positive integer' },
  checkTimeoutMinutes: { min: 1, label: 'a positive integer' }
}

const COMMAND_FIELDS = ['restoreCommand', 'buildCommand', 'testCommand', 'smokeCommand']
const STRING_ARRAY_FIELDS = ['requiredChecks', 'ignoredChecks', 'protectedPaths', 'runtimeLogs', 'commitTypes']

export async function auditConfig(repoPath) {
  const resolvedRepo = path.resolve(repoPath)
  const configPath = path.join(resolvedRepo, 'autopai.json')
  const report = {
    repoPath: resolvedRepo,
    configPath,
    exists: false,
    ok: false,
    status: 'missing',
    errors: [],
    warnings: [],
    missing: [],
    deprecated: [],
    unknown: []
  }

  let text
  try {
    text = await fs.readFile(configPath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      addError(report, 'missing-file', 'autopai.json', `No autopai.json found at ${configPath}.`)
      return finish(report)
    }
    addError(report, 'read-error', 'autopai.json', error.message)
    return finish(report)
  }
  report.exists = true

  let raw
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch (error) {
    addError(report, 'invalid-json', 'autopai.json', `Invalid JSON: ${error.message}`)
    return finish(report)
  }

  if (!isPlainObject(raw)) {
    addError(report, 'invalid-root', 'autopai.json', 'The configuration must be a JSON object.')
    return finish(report)
  }

  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      report.unknown.push(key)
      addError(report, 'unknown-field', key, `Unknown top-level field "${key}".`)
    }
  }

  for (const key of REQUIRED_KEYS) {
    if (!hasOwn(raw, key)) addError(report, 'missing-required', key, `Required field "${key}" is missing.`)
    else auditField(report, key, raw[key])
  }

  const defaultStateDir = await exists(path.join(resolvedRepo, 'tickets')) ? 'tickets/.autopai' : '.autopai'
  if (!hasOwn(raw, 'ticketDirs')) addMissing(report, 'ticketDirs', DEFAULT_TICKET_DIRS)
  if (!hasOwn(raw, 'stateDir')) addMissing(report, 'stateDir', defaultStateDir)

  for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
    if (DEPRECATED_FIELDS[key]) {
      if (!hasOwn(raw, key)) continue
      report.deprecated.push(key)
      addWarning(report, 'deprecated', key, DEPRECATED_FIELDS[key])
      if (typeof raw[key] !== 'boolean') addError(report, 'invalid-type', key, `"${key}" must be a boolean.`)
      continue
    }
    if (!hasOwn(raw, key)) {
      addMissing(report, key, defaultValue)
      continue
    }
    auditField(report, key, raw[key])
  }

  if (hasOwn(raw, 'ticketDirs')) auditTicketDirs(report, raw.ticketDirs)
  if (hasOwn(raw, 'stateDir')) auditStateDir(report, raw.stateDir)
  auditCheckOverlap(report, raw.requiredChecks, raw.ignoredChecks)
  return finish(report)
}

export function formatConfigReport(report) {
  const lines = [
    `autopai.json: ${report.status} (${report.errors.length} errors, ${report.warnings.length} warnings, ${report.missing.length} missing defaults)`
  ]
  for (const error of report.errors) lines.push(`ERROR ${error.field}: ${error.message}`)
  for (const warning of report.warnings) lines.push(`WARN ${warning.field}: ${warning.message}`)
  for (const missing of report.missing) {
    lines.push(`MISSING ${missing.field}: effective default ${JSON.stringify(missing.default)}.`)
  }
  return lines.join('\n')
}

function auditField(report, key, value) {
  if (key === 'runner') {
    if (!isNonEmptyString(value)) {
      addError(report, 'invalid-type', key, 'The runner must be a non-empty string.')
      return
    }
    if (!availableRunners().includes(value)) {
      addError(report, 'unknown-runner', key, `Unknown runner "${value}". Available runners: ${availableRunners().join(', ')}.`)
    }
    return
  }

  if (key === 'baseBranch' || key === 'releaseBranch') {
    if (!isNonEmptyString(value)) addError(report, 'invalid-type', key, `"${key}" must be a non-empty string.`)
    return
  }

  if (key === 'coverageThreshold') {
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) {
      addError(report, 'invalid-value', key, 'The coverage threshold must be null or a number between 0 and 1.')
    }
    return
  }

  if (key === 'billingCurrency') {
    if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
      addError(report, 'invalid-value', key, 'billingCurrency must be a three-letter ISO 4217 code.')
    }
    return
  }

  if (INTEGER_FIELDS[key]) {
    const rule = INTEGER_FIELDS[key]
    if (!Number.isInteger(value) || value < rule.min) {
      addError(report, 'invalid-value', key, `"${key}" must be ${rule.label}.`)
    }
    return
  }

  if (key === 'continueOnFailure') {
    if (typeof value !== 'boolean') addError(report, 'invalid-type', key, `"${key}" must be a boolean.`)
    return
  }

  if (key === 'pauseAfter') {
    auditPauseAfter(report, value)
    return
  }

  if (key === 'prTitle') {
    if (value !== null && typeof value !== 'string') addError(report, 'invalid-type', key, '"prTitle" must be a string or null.')
    return
  }

  if (COMMAND_FIELDS.includes(key)) {
    if (!isCommand(value)) addError(report, 'invalid-type', key, `"${key}" must be null or a non-empty array of strings.`)
    if (Array.isArray(value)) auditPersonalStrings(report, key, value)
    return
  }

  if (STRING_ARRAY_FIELDS.includes(key)) {
    if (!isStringArray(value, key === 'commitTypes')) {
      addError(report, 'invalid-type', key, `"${key}" must be an array of non-empty strings.`)
    }
    if (key === 'protectedPaths' && Array.isArray(value)) auditPersonalStrings(report, key, value)
    if (key === 'runtimeLogs' && Array.isArray(value)) auditPersonalStrings(report, key, value)
    return
  }

  if (key === 'runnerOptions') {
    auditRunnerOptions(report, value)
    return
  }

  if (key === 'agents') {
    auditNested(report, key, value, AGENT_KEYS, DEFAULT_AGENTS, (field, item) => {
      if (!isNonEmptyString(item)) addError(report, 'invalid-type', field, `"${field}" must be a non-empty string.`)
    })
    auditLegacyAgents(report, value)
    return
  }

  if (key === 'models') {
    auditNested(report, key, value, MODEL_KEYS, DEFAULT_MODELS, (field, item) => {
      if (item !== null && !isNonEmptyString(item)) addError(report, 'invalid-type', field, `"${field}" must be a string or null.`)
    })
  }
}

function auditNested(report, key, value, allowedKeys, defaults, validate) {
  if (!isPlainObject(value)) {
    addError(report, 'invalid-type', key, `"${key}" must be an object.`)
    return false
  }
  for (const child of Object.keys(value)) {
    if (!allowedKeys.includes(child)) {
      report.unknown.push(`${key}.${child}`)
      addError(report, 'unknown-field', `${key}.${child}`, `Unknown field "${key}.${child}".`)
    }
  }
  for (const child of allowedKeys) {
    if (!hasOwn(value, child)) {
      addMissing(report, `${key}.${child}`, defaults[child])
      continue
    }
    validate(`${key}.${child}`, value[child])
  }
  return true
}

function auditPauseAfter(report, value) {
  if (!Array.isArray(value)) {
    addError(report, 'invalid-type', 'pauseAfter', 'pauseAfter must be an array of gate names.')
    return
  }
  for (const item of value) {
    if (typeof item !== 'string' || !GATES.includes(item)) {
      addError(report, 'invalid-value', 'pauseAfter', `Invalid pause gate "${item}". Use one of: ${GATES.join(', ')}.`)
    }
  }
}

function auditTicketDirs(report, value) {
  auditNested(report, 'ticketDirs', value, TICKET_DIR_KEYS, DEFAULT_TICKET_DIRS, (field, item) => {
    if (!isLocalRelative(item)) addError(report, 'invalid-path', field, `"${field}" must be a relative path inside the repository.`)
  })
}

function auditStateDir(report, value) {
  if (!isLocalRelative(value)) {
    addError(report, 'invalid-path', 'stateDir', 'stateDir must be a relative path inside the repository.')
  }
}

function auditRunnerOptions(report, value) {
  if (!isPlainObject(value)) {
    addError(report, 'invalid-type', 'runnerOptions', 'runnerOptions must be an object.')
    return
  }
  auditSecretKeys(report, 'runnerOptions', value)
}

function auditSecretKeys(report, prefix, value) {
  if (!isPlainObject(value)) return
  for (const [key, item] of Object.entries(value)) {
    const field = `${prefix}.${key}`
    if (/token|secret|password|api[_-]?key/i.test(key)) {
      addWarning(report, 'secret-like', field, 'Secret-like keys should use environment expansion and must not store credentials.')
    }
    if (isPlainObject(item)) auditSecretKeys(report, field, item)
  }
}

function auditPersonalStrings(report, field, values) {
  values.forEach((value, index) => {
    if (typeof value === 'string' && looksPersonal(value)) {
      addWarning(report, 'personal-path', `${field}[${index}]`, 'Avoid personal absolute paths; use an environment variable or a repository-relative path.')
    }
  })
}

function auditLegacyAgents(report, value) {
  if (!isPlainObject(value)) return
  if (value.executor === 'autopai' || value.executor === 'setup') {
    addWarning(report, 'legacy-agent', 'agents.executor', 'Use the executor agent name instead of the legacy setup or autopai name.')
  }
  if (value.operator === 'setup') {
    addWarning(report, 'legacy-agent', 'agents.operator', 'Use the autopai operator agent name instead of setup.')
  }
}

function auditCheckOverlap(report, required, ignored) {
  if (!Array.isArray(required) || !Array.isArray(ignored)) return
  const overlap = required.filter(check => ignored.includes(check))
  for (const check of overlap) {
    addWarning(report, 'check-overlap', 'ignoredChecks', `Check "${check}" is both required and ignored.`)
  }
}

function finish(report) {
  report.ok = report.errors.length === 0
  report.status = report.errors.length > 0
    ? 'error'
    : report.missing.length > 0
      ? 'outdated'
      : report.warnings.length > 0
        ? 'warning'
        : 'current'
  return report
}

function addError(report, code, field, message) {
  report.errors.push({ code, field, message })
}

function addWarning(report, code, field, message) {
  report.warnings.push({ code, field, message })
}

function addMissing(report, field, defaultValue) {
  report.missing.push({ field, default: defaultValue })
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function isCommand(value) {
  return value === null || (Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString))
}

function isStringArray(value, nonEmpty = false) {
  return Array.isArray(value) && (!nonEmpty || value.length > 0) && value.every(isNonEmptyString)
}

function isLocalRelative(value) {
  if (!isNonEmptyString(value)) return false
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) return false
  return !value.split(/[\\/]/).includes('..')
}

function looksPersonal(value) {
  return /^[A-Za-z]:[\\/](Users|Documents and Settings)[\\/]/i.test(value)
    || /^\/(home|Users)\//.test(value)
}
