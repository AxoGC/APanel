const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${UNITS[exp]}`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatBitrate(bytesPerSec: number): { value: string; unit: 'Kbps' | 'Mbps' } {
  const bitsPerSec = Math.max(0, bytesPerSec) * 8
  if (bitsPerSec < 1_000_000) {
    return { value: (bitsPerSec / 1_000).toFixed(1), unit: 'Kbps' }
  }
  return { value: (bitsPerSec / 1_000_000).toFixed(1), unit: 'Mbps' }
}
