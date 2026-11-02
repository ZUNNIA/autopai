import { runCommand } from './runner.js'

const SEVERITIES = ['error', 'warning', 'info']
const FILE_RE = /^(.*?)\((\d+)(?:,(\d+))?\):\s*(error|warning|info)\s+([A-Za-z]+\d+):\s*(.*)$/i
const TOOL_RE = /^([A-Za-z0-9_.-]+)\s*:\s*(error|warning|info)\s+([A-Za-z]+\d+):\s*(.*)$/i

export function parseSeverities(value) {
  const requested = String(value ?? 'error,warning').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)
  const invalid = requested.filter(item => !SEVERITIES.includes(item))
  if (invalid.length > 0) throw new Error(`Unknown diagnostic severity: ${invalid.join(', ')}. Use error, warning, or info.`)
  return [...new Set(requested)]
}

export function parseDiagnostics(text, severities = ['error', 'warning']) {
  const wanted = new Set(severities)
  const found = []
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    let diagnostic = null
    const fileMatch = line.match(FILE_RE)
    if (fileMatch) {
      const [, file, lineNumber, column, severity, code, rest] = fileMatch
      const projectMatch = rest.match(/\s+\[([^\]]+)\]$/)
      diagnostic = {
        severity: severity.toLowerCase(),
        code,
        file,
        line: Number(lineNumber),
        column: column ? Number(column) : null,
        project: projectMatch ? projectMatch[1] : null,
        message: (projectMatch ? rest.slice(0, projectMatch.index) : rest).trim()
      }
    } else {
      const toolMatch = line.match(TOOL_RE)
      if (toolMatch) {
        const [, tool, severity, code, message] = toolMatch
        diagnostic = { severity: severity.toLowerCase(), code, tool, file: null, line: null, column: null, project: null, message: message.trim() }
      }
    }
    if (diagnostic && wanted.has(diagnostic.severity)) found.push(diagnostic)
  }
  const unique = new Map()
  for (const diagnostic of found) {
    const key = [diagnostic.severity, diagnostic.code, diagnostic.file, diagnostic.line, diagnostic.column, diagnostic.message].join('|')
    if (!unique.has(key)) unique.set(key, diagnostic)
  }
  return [...unique.values()]
}

export function summarizeDiagnostics(diagnostics) {
  return diagnostics.reduce((summary, diagnostic) => {
    summary[diagnostic.severity] += 1
    return summary
  }, { error: 0, warning: 0, info: 0 })
}

export async function runBuildDiagnostics({ config, artifacts, severities }) {
  if (!Array.isArray(config.buildCommand) || config.buildCommand.length === 0) {
    throw new Error('No buildCommand is configured; diagnostics cannot run.')
  }
  if (Array.isArray(config.restoreCommand) && config.restoreCommand.length > 0) {
    const [restoreExecutable, ...restoreArgs] = config.restoreCommand
    await runCommand(restoreExecutable, restoreArgs, {
      cwd: config.repoPath,
      timeoutMs: config.commandTimeoutMinutes * 60000,
      logFile: artifacts?.path?.('diagnostics-restore.log')
    })
  }
  const [executable, ...args] = config.buildCommand
  const result = await runCommand(executable, args, {
    cwd: config.repoPath,
    timeoutMs: config.commandTimeoutMinutes * 60000,
    logFile: artifacts?.path?.('diagnostics-build.log')
  })
  const diagnostics = parseDiagnostics(`${result.stdout}\n${result.stderr}`, severities)
  return {
    exitCode: result.code,
    diagnostics,
    summary: summarizeDiagnostics(diagnostics),
    output: (result.stdout || result.stderr || '').trim()
  }
}