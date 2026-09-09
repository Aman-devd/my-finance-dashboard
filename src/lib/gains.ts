import dayjs from 'dayjs'
import type { AppData } from '../types'
import { ETF, dailySeriesBetween, findMeta } from './market'

export interface Point { date: string; close: number }

export interface YearReturn {
  year: number
  startPrice: number
  endPrice: number
  pnl: number      // shares*(end-start)
  pnlPct: number
  days: number
}

export interface DrawdownInfo {
  pct: number      // 最大回撤 %（正数表示回撤幅度）
  amount: number
  peakDate: string
  troughDate: string
  series: { date: string; ddPct: number }[]
}

export function holdingsShares(data: AppData): { shares: number; cost: number } {
  const shares = data.holdings.reduce((s, h) => s + h.shares, 0)
  const cost = data.holdings.reduce((s, h) => s + h.shares * h.avgCost, 0)
  return { shares, cost }
}

/** 记录起始日：最早交易 → 用户设置 → 默认一年前 */
export function investStart(data: AppData): string {
  const fromTrades = data.trades.map((t) => t.date).sort()
  if (fromTrades.length) return fromTrades[0]
  return data.settings.investStartDate || dayjs().subtract(1, 'year').format('YYYY-MM-DD')
}

/** 从起始日到今天的数据点（按持仓份额估算市值，未考虑期间加减仓） */
export function seriesFromStart(data: AppData, start?: string): Point[] {
  const s = start || investStart(data)
  const { shares } = holdingsShares(data)
  if (shares <= 0) return []
  const meta = findMeta('sh513100')
  const pts = dailySeriesBetween(meta, s, dayjs().format('YYYY-MM-DD'))
  return pts
}

/** 逐年收益表 */
export function yearlyReturns(data: AppData, pts: Point[]): YearReturn[] {
  const { shares } = holdingsShares(data)
  if (!pts.length) return []
  const rows: YearReturn[] = []
  const years = [...new Set(pts.map((p) => p.date.slice(0, 4)))].sort()
  for (const y of years) {
    const inYear = pts.filter((p) => p.date.startsWith(y))
    const prevEnd = pts.filter((p) => p.date < `${y}-01-01`).slice(-1)[0]
    const startPrice = prevEnd ? prevEnd.close : inYear[0].close
    const endPrice = inYear[inYear.length - 1].close
    rows.push({
      year: parseInt(y),
      startPrice,
      endPrice,
      pnl: shares * (endPrice - startPrice),
      pnlPct: startPrice ? ((endPrice - startPrice) / startPrice) * 100 : 0,
      days: inYear.length,
    })
  }
  return rows
}

/** 回撤分析（基于市值序列） */
export function drawdownAnalysis(pts: Point[], shares: number): DrawdownInfo | null {
  if (pts.length < 2) return null
  let peak = pts[0].close
  let peakDate = pts[0].date
  let maxPct = 0
  let maxAmount = 0
  let troughDate = pts[0].date
  const series: { date: string; ddPct: number }[] = []
  for (const p of pts) {
    if (p.close > peak) {
      peak = p.close
      peakDate = p.date
    }
    const ddPct = ((p.close - peak) / peak) * 100 // <=0
    const ddAmt = (p.close - peak) * shares
    series.push({ date: p.date, ddPct: +(ddPct).toFixed(2) })
    if (ddPct < maxPct) {
      maxPct = ddPct
      maxAmount = ddAmt
      troughDate = p.date
    }
  }
  return { pct: Math.abs(maxPct), amount: Math.abs(maxAmount), peakDate, troughDate, series }
}

/** 区间收益：给定起点终点 close 的收益 */
export function rangeReturnBy(pts: Point[], from: string, to: string, shares: number): { pnl: number; pnlPct: number } | null {
  const a = pts.find((p) => p.date >= from)
  const b = pts.filter((p) => p.date <= to).slice(-1)[0]
  if (!a || !b) return null
  return { pnl: shares * (b.close - a.close), pnlPct: a.close ? ((b.close - a.close) / a.close) * 100 : 0 }
}
