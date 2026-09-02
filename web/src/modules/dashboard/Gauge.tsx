import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef, useState } from 'react'

echarts.use([GaugeChart, CanvasRenderer])

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

function readGaugeColors() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const probe = document.createElement('div')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const get = (className: string) => {
    probe.className = className
    return resolveColor(probe, ctx)
  }
  const colors = {
    progress: get('text-theme-500'),
    track: get('text-gray-200 dark:text-gray-800'),
    emphasis: get('text-gray-900 dark:text-gray-100'),
    muted: get('text-gray-500'),
  }
  document.body.removeChild(probe)
  return colors
}

/** Re-reads the resolved colors whenever the color scheme (data-theme) or
 * the user-switchable theme hue (a `style` attribute mutation on <html>,
 * see lib/theme.ts) changes. */
function useGaugeColors() {
  const [colors, setColors] = useState(readGaugeColors)
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readGaugeColors()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    return () => observer.disconnect()
  }, [])
  return colors
}

export function Gauge({
  label,
  value,
  percentText,
  details,
}: {
  label: string
  value: number
  percentText: string
  details?: string[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const colors = useGaugeColors()

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption({
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          radius: '100%',
          pointer: { show: false },
          progress: { show: true, width: 10, roundCap: true, itemStyle: { color: colors.progress } },
          axisLine: { lineStyle: { width: 10, color: [[1, colors.track]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          // The percentage — emphasized via size, not weight (kept at the
          // series' base font weight rather than a bold override).
          detail: {
            formatter: () => percentText,
            fontSize: 22,
            color: colors.emphasis,
            offsetCenter: [0, '0%'],
          },
          // The label ("CPU"/"Memory") — de-emphasized, below the percentage.
          title: {
            offsetCenter: [0, '32%'],
            fontSize: 11,
            color: colors.muted,
          },
          data: [{ value: Math.min(100, Math.max(0, value)), name: label }],
        },
      ],
    })
  }, [value, label, percentText, colors])

  return (
    <div className="flex flex-col items-center">
      <div ref={containerRef} className="h-32 w-full" />
      {details && details.length > 0 && (
        <div className="-mt-2 flex flex-col items-center">
          {details.map((line) => (
            <span key={line} className="text-xs text-gray-500">
              {line}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
