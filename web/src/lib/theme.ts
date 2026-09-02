import colors from 'tailwindcss/colors'

// The chromatic hues a user can pick as the theme color. Deliberately
// excludes Tailwind's neutral/gray-ish palettes: those are reserved for the
// grayscale UI itself, never the theme color.
export const THEME_HUES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const

export type ThemeHue = (typeof THEME_HUES)[number]

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

const DEFAULT_THEME_HUE: ThemeHue = 'blue'
const THEME_HUE_STORAGE_KEY = 'apanel:theme-hue'

export function applyThemeHue(hue: ThemeHue) {
  const palette = colors[hue] as Record<number, string>
  const root = document.documentElement
  for (const shade of SHADES) {
    root.style.setProperty(`--theme-${shade}`, palette[shade])
  }
}

export function getStoredThemeHue(): ThemeHue {
  const stored = localStorage.getItem(THEME_HUE_STORAGE_KEY)
  return (THEME_HUES as readonly string[]).includes(stored ?? '')
    ? (stored as ThemeHue)
    : DEFAULT_THEME_HUE
}

export function setStoredThemeHue(hue: ThemeHue) {
  localStorage.setItem(THEME_HUE_STORAGE_KEY, hue)
  applyThemeHue(hue)
}

export type ColorScheme = 'light' | 'dark' | 'system'

const SCHEME_STORAGE_KEY = 'apanel:scheme'

function resolveScheme(scheme: ColorScheme): 'light' | 'dark' {
  if (scheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return scheme
}

function applyResolvedScheme(scheme: ColorScheme) {
  document.documentElement.setAttribute('data-theme', resolveScheme(scheme))
}

export function getStoredScheme(): ColorScheme {
  const stored = localStorage.getItem(SCHEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export function setStoredScheme(scheme: ColorScheme) {
  localStorage.setItem(SCHEME_STORAGE_KEY, scheme)
  applyResolvedScheme(scheme)
}

/** Applies the persisted theme hue and color scheme; call once on boot. */
export function initTheme() {
  applyThemeHue(getStoredThemeHue())
  applyResolvedScheme(getStoredScheme())

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredScheme() === 'system') applyResolvedScheme('system')
  })
}
