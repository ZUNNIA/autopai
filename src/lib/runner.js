import fs from 'node:fs/promises'
import path from 'node:path'
import crossSpawn from 'cross-spawn'
import { ensureDir } from './util.js'

/**
 * Runs a command without a shell, captures both streams, and optionally
 * appends the complete transcript to a log file.
 */
export async function runCommand(command, args = [], options = {}) {
  const { cwd, env, timeoutMs = 0, logFile } = options
  return new Promise(resolve => {
    const child = crossSpawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const finish = async code => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (logFile) {
        await ensureDir(path.dirname(logFile))
        await fs.appendFile(
          logFile,
          `$ ${command} ${args.join(' ')}\n${stdout}${stderr}\n[exit ${code}${timedOut ? ' timed out' : ''}]\n\n`,
          'utf8'
        )
      }
      resolve({ code, stdout, stderr, timedOut })
    }

    const timer = timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true
          killTree(child)
        }, timeoutMs)
      : null

    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.on('error', error => {
      stderr += `${stderr ? '\n' : ''}${error.message}`
      void finish(-1)
    })
    child.on('close', code => { void finish(code) })
  })
}

/**
 * Kills a child process and its descendants. Windows requires taskkill for a
 * reliable tree kill because SIGTERM is not propagated to grandchildren.
 */
export function killTree(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    crossSpawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    return
  }
  child.kill('SIGKILL')
}
