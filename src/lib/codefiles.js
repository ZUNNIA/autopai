import { runCommand } from './runner.js'

const CODE_EXTENSIONS = /\.(cs|py|ts|tsx|js|jsx|rs|go|java|kt)$/i

/**
 * Lists the code files under a repository-relative directory. Git is the source
 * of truth: tracked and untracked files are included and every ignore rule is
 * honored, so generated, vendored, and local artifact directories never enter
 * an audit.
 */
export async function listCodeFiles(repoPath, relativeDir = '.') {
  const target = relativeDir || '.'
  const result = await runCommand('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', target], {
    cwd: repoPath,
    timeoutMs: 120000
  })
  if (result.code !== 0) throw new Error(`git ls-files failed: ${result.stderr || result.stdout}`)

  const root = target.replace(/\\/g, '/').replace(/\/+$/, '')
  const files = result.stdout.split('\u0000').filter(Boolean)
  return [...new Set(files)]
    .filter(file => CODE_EXTENSIONS.test(file))
    .filter(file => root === '.' || root === '' || file === root || file.startsWith(`${root}/`))
    .sort()
}
