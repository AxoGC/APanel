import { useEffect, useState } from 'react'

// echarts (canvas-based) can't parse the app's oklch() theme colors
// directly, so colors are resolved through a hidden probe element: give it
// the same Tailwind classes the rest of the UI uses (letting the `dark:`
// variant and the runtime theme-hue CSS vars do their normal job), read the
// computed `color`, then round-trip it through a canvas 2D context — which
// the spec guarantees serializes back out as a plain hex/rgba string.
function resolveColor(el: HTMLElement, ctx: CanvasRenderingContext2D): string {
  ctx.fillStyle = getComputedStyle(el).color
  return ctx.fillStyle
}

export function readThemeColors<K extends string>(classNames: Record<K, string>): Record<K, string> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const probe = document.createElement('div')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const result = {} as Record<K, string>
  for (const key in classNames) {
    probe.className = classNames[key]
    result[key] = resolveColor(probe, ctx)
  }
  document.body.removeChild(probe)
  return result
}

/** Re-reads the resolved colors whenever the color scheme (data-theme) or
 * the user-switchable theme hue (a `style` attribute mutation on <html>,
 * see lib/theme.ts) changes. */
export function useThemeColors<K extends string>(classNames: Record<K, string>): Record<K, string> {
  const [colors, setColors] = useState(() => readThemeColors(classNames))
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readThemeColors(classNames)))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return colors
}
