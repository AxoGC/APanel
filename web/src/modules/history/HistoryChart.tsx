import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { useThemeColors } from '@/lib/chartColors'
import { cn } from '@/lib/utils'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

export function HistoryChart({
  label,
  times,
  values,
  unit,
  max = 100,
  formatValue,
  heightClassName = 'h-48',
}: {
  label: string
  times: string[]
  values: number[]
  unit?: string
  max?: number | null
  formatValue?: (value: number) => string
  heightClassName?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const colors = useThemeColors({
    line: 'text-theme-500',
    area: 'text-theme-100 dark:text-theme-950',
    axis: 'text-gray-400',
    split: 'text-gray-100 dark:text-gray-900',
  })

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    // A ResizeObserver (rather than a window resize listener) also catches
    // the container changing width on its own — e.g. the history page's
    // column-count toggle reflowing the grid without the window itself
    // resizing, which otherwise leaves the canvas at its old width,
    // overflowing into the next grid column.
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    // No unit suffix here — the unit (if any) is shown once, next to the
    // chart's title, instead of repeated on every axis tick/tooltip line.
    const format = formatValue ?? ((v: number) => `${v}`)
    chartRef.current?.setOption({
      grid: { left: 40, right: 12, top: 16, bottom: 24 },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLine: { lineStyle: { color: colors.split } },
        axisTick: { show: false },
        axisLabel: { color: colors.axis, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: max ?? undefined,
        splitLine: { lineStyle: { color: colors.split } },
        axisLabel: { color: colors.axis, fontSize: 10, formatter: (v: number) => format(v) },
      },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => format(v as number) },
      series: [
        {
          name: label,
          type: 'line',
          data: values,
          showSymbol: false,
          smooth: true,
          lineStyle: { color: colors.line, width: 2 },
          areaStyle: { color: colors.area },
          // Without this, echarts' built-in hover/click emphasis-blur state
          // fades the line and area down to near-invisible on tap/click,
          // leaving only the axis-pointer tooltip marker visible until the
          // pointer leaves — the tooltip itself doesn't need emphasis on.
          emphasis: { disabled: true },
        },
      ],
    })
  }, [times, values, max, formatValue, colors, label])

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">
        {label}
        {unit && ` (${unit})`}
      </span>
      <div ref={containerRef} className={cn(heightClassName, 'w-full')} />
    </div>
  )
}
