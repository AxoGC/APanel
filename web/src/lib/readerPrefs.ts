// Persisted preferences for TextReader (line numbers, text wrap) — plain
// booleans, no DOM-wide side effect, so a simple localStorage round-trip
// read once per mount (same lightweight pattern as theme.ts) is enough.
const LINE_NUMBERS_KEY = 'apanel:reader-line-numbers'
const TEXT_WRAP_KEY = 'apanel:reader-wrap'

function getStoredBool(key: string, fallback: boolean): boolean {
  const stored = localStorage.getItem(key)
  return stored === null ? fallback : stored === 'true'
}

export function getStoredReaderLineNumbers(): boolean {
  return getStoredBool(LINE_NUMBERS_KEY, true)
}

export function setStoredReaderLineNumbers(value: boolean) {
  localStorage.setItem(LINE_NUMBERS_KEY, String(value))
}

export function getStoredReaderTextWrap(): boolean {
  return getStoredBool(TEXT_WRAP_KEY, true)
}

export function setStoredReaderTextWrap(value: boolean) {
  localStorage.setItem(TEXT_WRAP_KEY, String(value))
}
