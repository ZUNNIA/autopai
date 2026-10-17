/**
 * Matches repository-relative paths against the protected globs declared in
 * `.autopilot.json`. Patterns use `**` for any characters including slashes,
 * `*` for any characters except slashes, and `?` for one character.
 */
export function findForbidden(files, patterns = []) {
  const matchers = patterns.map(globToRegExp)
  return (files ?? []).filter(file => matchers.some(regex => regex.test(file)))
}

export function globToRegExp(pattern) {
  let source = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*'
        index += 1
      } else {
        source += '[^/]*'
      }
    } else if (char === '?') {
      source += '[^/]'
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${source}$`)
}
