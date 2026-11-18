import { readFile } from 'node:fs/promises'

/**
 * Resolves a CLI review message from either --message or --message-file.
 * The file form avoids the Windows cmd shim truncating multi-line arguments.
 */
export async function readCliMessage(options, usage) {
  if (options.message !== undefined && typeof options.message !== 'string') throw new Error(usage)
  if (options.messageFile !== undefined && typeof options.messageFile !== 'string') throw new Error(usage)

  const direct = typeof options.message === 'string' ? options.message.trim() : ''
  const file = typeof options.messageFile === 'string' ? options.messageFile.trim() : ''
  if (direct && file) throw new Error('Use --message or --message-file, not both.')

  let message = direct
  if (file) {
    try {
      message = String(await readFile(file, 'utf8')).trim()
    } catch (error) {
      throw new Error(`Could not read message file ${file}: ${error.message}`)
    }
  }
  if (!message || message === 'true') throw new Error(usage)
  return message
}

/**
 * Resolves a free-form description from either --description or --description-file.
 * The file form avoids the Windows cmd shim truncating multi-line inputs.
 */
export async function readCliDescription(options, usage) {
  if (options.description !== undefined && typeof options.description !== 'string') throw new Error(usage)
  if (options.descriptionFile !== undefined && typeof options.descriptionFile !== 'string') throw new Error(usage)

  const direct = typeof options.description === 'string' ? options.description.trim() : ''
  const file = typeof options.descriptionFile === 'string' ? options.descriptionFile.trim() : ''
  if (direct && file) throw new Error('Use --description or --description-file, not both.')

  let description = direct
  if (file) {
    try {
      description = String(await readFile(file, 'utf8')).trim()
    } catch (error) {
      throw new Error(`Could not read description file ${file}: ${error.message}`)
    }
  }
  return description
}

/**
 * Reads a required text file option such as --content-file.
 */
export async function readCliTextFile(value, flag, usage) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(usage)
  const file = value.trim()
  try {
    return String(await readFile(file, 'utf8')).trim()
  } catch (error) {
    throw new Error(`Could not read ${flag} file ${file}: ${error.message}`)
  }
}
