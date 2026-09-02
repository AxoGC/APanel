import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { useThemeColors } from '@/lib/chartColors'

echarts.use([GaugeChart, CanvasRenderer])

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
  const colors = useThemeColors({
    progress: 'text-theme-500',
    track: 'text-gray-200 dark:text-gray-800',
    emphasis: 'text-gray-900 dark:text-gray-100',
    muted: 'text-gray-500',
  })

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
      {/* relative: echarts positions its hover-interaction canvas layer
          absolutely against the nearest positioned ancestor — without this,
          it lands relative to some ancestor further up the tree and the
          hovered/clicked element appears to vanish until the layer merges
          back on mouseout. */}
      <div ref={containerRef} className="relative h-32 w-full" />
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
