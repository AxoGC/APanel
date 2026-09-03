import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef, useState } from 'react'
import { useThemeColors } from '@/lib/chartColors'

echarts.use([GaugeChart, CanvasRenderer])

export function Gauge({
  label,
  value,
  mainText,
  unitText,
  details,
}: {
  label: string
  value: number
  mainText: string
  unitText?: string
  details?: string[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const colors = useThemeColors({
    progress: 'text-theme-500',
    track: 'text-gray-200 dark:text-gray-800',
    emphasis: 'text-gray-900 dark:text-gray-100',
    muted: 'text-gray-500',
  })

  // Matches Tailwind's sm breakpoint — the same one the details text and
  // container height already key off — so the main number shrinks in step
  // with everything else around it on narrow screens.
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 639px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = () => setIsNarrow(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
          // This gauge is a static readout, not an interactive chart — without
          // this, echarts' built-in hover/click emphasis-blur state kicks in
          // on tap/click and fades the progress arc down to near-invisible
          // until the pointer leaves.
          emphasis: { disabled: true },
          pointer: { show: false },
          progress: { show: true, width: 10, roundCap: true, itemStyle: { color: colors.progress } },
          axisLine: { lineStyle: { width: 10, color: [[1, colors.track]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          // The value — emphasized via size, not weight (kept at the
          // series' base font weight rather than a bold override). The
          // unit suffix (%, Mbps) is rendered smaller and in the muted
          // color so the number itself reads first.
          detail: {
            formatter: () => (unitText ? `{main|${mainText}}{unit|${unitText}}` : mainText),
            rich: {
              main: { fontSize: isNarrow ? 17 : 22, color: colors.emphasis },
              unit: { fontSize: 12, color: colors.muted, padding: [0, 0, 0, 1] },
            },
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
  }, [value, label, mainText, unitText, colors, isNarrow])

  return (
    <div className="flex flex-col items-center">
      <div ref={containerRef} className="h-24 w-full sm:h-32" />
      {details && details.length > 0 && (
        <div className="-mt-2 flex flex-col items-center">
          {details.map((line) => (
            <span key={line} className="text-[10px] text-gray-500 sm:text-xs">
              {line}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
