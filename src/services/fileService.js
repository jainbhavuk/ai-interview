const SUPPORTED_TEXT_EXTENSIONS = ['txt', 'md', 'json', 'csv', 'log']
const MAX_RECOMMENDED_FILE_SIZE = 1024 * 1024 * 2

function getExtension(fileName) {
  const segments = String(fileName || '').split('.')
  return segments.length > 1 ? segments.pop().toLowerCase() : ''
}

/**
 * Reads uploaded file content as plain text.
 * @param {File} file
 * @returns {Promise<{text: string, warning: string}>}
 */
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const extension = getExtension(file?.name)
    const extensionWarning = SUPPORTED_TEXT_EXTENSIONS.includes(extension)
      ? ''
      : 'Non-text files may not parse correctly in this backend-free prototype.'
    const sizeWarning =
      file?.size > MAX_RECOMMENDED_FILE_SIZE
        ? 'Large files may affect responsiveness. Prefer a smaller text-only resume/JD extract.'
        : ''
    const warning = [extensionWarning, sizeWarning].filter(Boolean).join(' ')

    const reader = new FileReader()

    reader.onload = (event) => {
      resolve({
        text: String(event.target?.result || ''),
        warning,
      })
    }

    reader.onerror = () => {
      reject(new Error('Could not read this file. Try copy-pasting plain text instead.'))
    }

    reader.readAsText(file)
  })
}
