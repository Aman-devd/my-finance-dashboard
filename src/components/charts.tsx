import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

// 小屏自适应：按容器宽度缩放字号（320~390 手机更小、更紧凑）
function scaleOption(v: unknown, k: number): unknown {
  if (Array.isArray(v)) {
    // 数据数组（数值/字符串）直接复用，避免无谓深拷贝
    let simple = true
    for (const item of v) if (item && typeof item === 'object') { simple = false; break }
    if (simple) return v
    return v.map((item) => scaleOption(item, k))
  }
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = { ...(v as Record<string, unknown>) }
    for (const key of Object.keys(out)) {
      const val = out[key]
      if ((key === 'fontSize' || key === 'lineHeight') && typeof val === 'number') out[key] = Math.max(8, Math.round(val * k))
      else out[key] = scaleOption(val, k)
    }
    return out
  }
  return v
}

function smartK(width: number): number {
  if (!width || width < 380) return 0.85
  if (width < 520) return 0.92
  return 1
}

export function EChart({ option, height = 260, className }: { option: echarts.EChartsOption; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const optionRef = useRef(option)
  const kRef = useRef(1)
  optionRef.current = option

  const applyOption = () => {
    const c = chart.current
    const el = ref.current
    if (!c || !el) return
    const width = el.clientWidth
    const k = smartK(width)
    kRef.current = k
    c.setOption(scaleOption(optionRef.current, k) as echarts.EChartsOption, true)
    c.resize()
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const c = echarts.init(el, undefined, { renderer: 'canvas' })
    chart.current = c
    kRef.current = smartK(el.clientWidth)
    c.setOption(scaleOption(optionRef.current, kRef.current) as echarts.EChartsOption, true)
    const ro = new ResizeObserver(() => applyOption())
    ro.observe(el)
    return () => { ro.disconnect(); c.dispose(); chart.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { applyOption() }, [option]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} className={className} style={{ height }} />
}

const AXIS = { axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9' } } }

const baseTooltip = {
  trigger: 'axis' as const,
  backgroundColor: 'rgba(15,23,42,0.92)', borderWidth: 0, textStyle: { color: '#fff', fontSize: 12 },
  confine: true, // 小屏上避免 tooltip 溢出图表
}

// 类目很多时，自动隔几个显示一个刻度，避免小屏文字挤成一团
function catInterval(n: number): number {
  if (n <= 8) return 0
  return Math.max(1, Math.ceil(n / 7))
}

export function lineOption(x: string[], series: { name: string; data: number[]; color?: string; area?: boolean; dashed?: boolean }[], opts?: { yFmt?: (v: number) => string; height?: number }): echarts.EChartsOption {
  return {
    tooltip: { ...baseTooltip, valueFormatter: (v: unknown) => (opts?.yFmt ? opts.yFmt(Number(v)) : String(v)) },
    grid: { left: 8, right: 12, top: 32, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: x, boundaryGap: false, axisTick: { show: false }, ...AXIS, axisLabel: { ...AXIS.axisLabel, interval: catInterval(x.length) } },
    yAxis: { type: 'value', scale: true, ...AXIS, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: series.map((s) => ({
      name: s.name, type: 'line', data: s.data, smooth: true, showSymbol: false,
      lineStyle: { width: 2, color: s.color, type: s.dashed ? 'dashed' : 'solid' },
      itemStyle: { color: s.color },
      areaStyle: s.area ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: (s.color || '#2563eb') + '44' }, { offset: 1, color: (s.color || '#2563eb') + '05' }] } } : undefined,
    })),
    legend: { top: 0, right: 0, textStyle: { color: '#64748b', fontSize: 11 }, icon: 'roundRect', itemWidth: 10, itemHeight: 3, itemGap: 12 },
  }
}

export function barOption(x: string[], series: { name: string; data: number[]; color?: string; stack?: string }[]): echarts.EChartsOption {
  return {
    tooltip: baseTooltip,
    grid: { left: 8, right: 12, top: 32, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: x, axisTick: { show: false }, ...AXIS, axisLabel: { ...AXIS.axisLabel, interval: catInterval(x.length) } },
    yAxis: { type: 'value', ...AXIS },
    series: series.map((s) => ({ name: s.name, type: 'bar', data: s.data, stack: s.stack, barMaxWidth: 22, itemStyle: { color: s.color, borderRadius: s.stack ? 2 : [4, 4, 0, 0] } })),
    legend: { top: 0, right: 0, textStyle: { color: '#64748b', fontSize: 11 }, icon: 'roundRect', itemWidth: 10, itemHeight: 3, itemGap: 12 },
  }
}

export function pieOption(items: { name: string; value: number; color?: string }[], opts?: { donut?: boolean }): echarts.EChartsOption {
  return {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(15,23,42,0.92)', borderWidth: 0, textStyle: { color: '#fff', fontSize: 12 }, confine: true },
    series: [{
      type: 'pie', radius: opts?.donut ? ['46%', '72%'] : '72%', center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 10, lineHeight: 14, color: '#64748b' },
      emphasis: { label: { fontWeight: 600 } },
      data: items.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } })),
    }],
  }
}

export function candleOption(dates: string[], ohlc: [number, number, number, number][], extra?: { ma?: number[] }): echarts.EChartsOption {
  return {
    tooltip: { ...baseTooltip, formatter: (p: unknown) => {
      const arr = p as { dataIndex: number }[]
      const i = arr[0]?.dataIndex ?? 0
      const d = dates[i]; const [o, c, l, h] = ohlc[i]
      if (!d || !Array.isArray(ohlc[i])) return ''
      return `${d}<br/>开 ${o.toFixed(3)}　收 ${c.toFixed(3)}<br/>低 ${l.toFixed(3)}　高 ${h.toFixed(3)}`
    } },
    grid: { left: 8, right: 12, top: 20, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: dates, axisTick: { show: false }, axisLine: AXIS.axisLine, axisLabel: { color: '#94a3b8', fontSize: 10, interval: catInterval(dates.length) } },
    yAxis: { type: 'value', scale: true, ...AXIS },
    dataZoom: [{ type: 'inside', start: dates.length > 120 ? 55 : 0, end: 100 }],
    series: [{
      type: 'candlestick', data: ohlc,
      itemStyle: { color: '#ef4444', color0: '#22c55e', borderColor: '#ef4444', borderColor0: '#22c55e' },
    }],
  }
}

export function areaOption(x: string[], data: number[], color = '#2563eb', opts?: { fill?: boolean }): echarts.EChartsOption {
  return lineOption(x, [{ name: '', data, color, area: opts?.fill ?? true }], { yFmt: (v) => v.toLocaleString() })
}

/** 分时图：上方价格折线 + 下方成交量柱状 */
export function intradayOption(x: string[], prices: number[], volumes: number[], color = '#2563eb'): echarts.EChartsOption {
  const up = prices.length > 1 ? prices[prices.length - 1] >= prices[0] : true
  const lineColor = up ? '#dc2626' : '#16a34a'
  return {
    tooltip: {
      ...baseTooltip,
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: unknown) => {
        const arr = params as { axisValue: string; data: unknown }[]
        if (!arr || !arr.length) return ''
        const t = arr[0].axisValue
        const price = arr.find((p) => (p as { seriesName?: string }).seriesName === '价格')?.data
        const vol = arr.find((p) => (p as { seriesName?: string }).seriesName === '成交量')?.data
        const volStr = typeof vol === 'number' ? (vol >= 10000 ? (vol / 10000).toFixed(2) + '万' : String(vol)) : '-'
        return `<div style="font-size:12px">${t}<br/>价格: <b>${Number(price).toLocaleString()}</b><br/>成交量: <b>${volStr}</b></div>`
      },
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: 8, right: 12, top: 10, height: '58%', containLabel: true },
      { left: 8, right: 12, top: '72%', height: '18%', containLabel: true },
    ],
    xAxis: [
      { type: 'category', data: x, boundaryGap: false, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
      { type: 'category', gridIndex: 1, data: x, boundaryGap: true, axisTick: { show: false }, ...AXIS, axisLabel: { ...AXIS.axisLabel, interval: catInterval(x.length) } },
    ],
    yAxis: [
      { type: 'value', scale: true, ...AXIS, splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => v.toLocaleString() } },
      { type: 'value', gridIndex: 1, scale: true, splitNumber: 2, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94a3b8', fontSize: 10, formatter: (v: number) => v >= 10000 ? (v / 10000).toFixed(0) + '万' : String(v) }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '价格', type: 'line', data: prices, smooth: true, showSymbol: false,
        lineStyle: { width: 2, color: lineColor },
        itemStyle: { color: lineColor },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: lineColor + '33' }, { offset: 1, color: lineColor + '05' }] } },
      },
      {
        name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: volumes,
        barWidth: '60%',
        itemStyle: { color: (p: { dataIndex: number }) => p.dataIndex > 0 && prices[p.dataIndex] >= prices[p.dataIndex - 1] ? '#dc262688' : '#16a34a88' },
      },
    ],
  }
}

export function barGaugeOption(items: { name: string; value: number; color?: string }[]): echarts.EChartsOption {
  return {
    tooltip: { ...baseTooltip, trigger: 'axis' },
    grid: { left: 8, right: 24, top: 6, bottom: 4, containLabel: true },
    xAxis: { type: 'value', ...AXIS },
    yAxis: { type: 'category', data: items.map((i) => i.name), axisLabel: { color: '#64748b', fontSize: 11 }, axisTick: { show: false } },
    series: [{ type: 'bar', data: items.map((i) => ({ value: i.value, itemStyle: { color: i.color || '#2563eb', borderRadius: 4 } })), barMaxWidth: 14, label: { show: true, position: 'right', color: '#64748b', fontSize: 10 } }],
  }
}
