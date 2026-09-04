const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

export function isImageFile(name: string): boolean {
  const idx = name.lastIndexOf('.')
  if (idx < 0) return false
  return IMAGE_EXTENSIONS.has(name.slice(idx + 1).toLowerCase())
}
