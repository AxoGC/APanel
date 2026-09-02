import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { useThemeColors } from '@/lib/chartColors'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

export function HistoryChart({
  label,
  times,
  values,
  unit,
}: {
  label: string
  times: string[]
  values: number[]
  unit: string
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
        max: 100,
        splitLine: { lineStyle: { color: colors.split } },
        axisLabel: { color: colors.axis, fontSize: 10, formatter: `{value}${unit}` },
      },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${v}${unit}` },
      series: [
        {
          name: label,
          type: 'line',
          data: values,
          showSymbol: false,
          smooth: true,
          lineStyle: { color: colors.line, width: 2 },
          areaStyle: { color: colors.area },
        },
      ],
    })
  }, [times, values, unit, colors, label])

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {/* relative: echarts positions its hover-interaction canvas layer
          absolutely against the nearest positioned ancestor — without this,
          it lands relative to some ancestor further up the tree and the
          hovered/clicked line/area appears to vanish until the layer merges
          back on mouseout. */}
      <div ref={containerRef} className="relative h-48 w-full" />
    </div>
  )
}
