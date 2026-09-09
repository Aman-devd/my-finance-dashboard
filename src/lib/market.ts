import dayjs from 'dayjs'
import { getLiveQuote, getKlineRows, getMinuteRows, getCachedMinute, getRealtimeMinute } from './quotes'

// ===== 演示行情（真实数据接入前使用）=====

export interface Quote {
  symbol: string
  name: string
  price: number
  prevClose: number
  change: number
  changePct: number
  open: number
  high: number
  low: number
  time: string
}

export interface MarketMeta {
  symbol: string
  name: string
  exchange: 'US' | 'CN'
  base: number
  decimals: number
  session: [number, number] // 开盘/收盘(小时，本地大致时段)
}

export const INDICES: MarketMeta[] = [
  { symbol: 'NDX', name: '纳斯达克100', exchange: 'US', base: 22350, decimals: 2, session: [21.5, 4] },
  { symbol: 'IXIC', name: '纳斯达克综合', exchange: 'US', base: 20580, decimals: 2, session: [21.5, 4] },
  { symbol: 'SPX', name: '标普500', exchange: 'US', base: 6080, decimals: 2, session: [21.5, 4] },
  { symbol: 'DJI', name: '道琼斯', exchange: 'US', base: 44780, decimals: 2, session: [21.5, 4] },
]

export const ETF: MarketMeta = { symbol: 'sh513100', name: '纳指100ETF(513100)', exchange: 'CN', base: 2.18, decimals: 3, session: [9.5, 15] }

export const ALL_MARKETS: MarketMeta[] = [...INDICES, ETF]

/** 根据股票代码动态创建标的元数据（用于用户输入任意代码） */
export function createMetaFromCode(symbol: string, name: string): MarketMeta {
  const isUs = symbol.startsWith('us')
  const isCn = symbol.startsWith('sh') || symbol.startsWith('sz')
  return {
    symbol,
    name: name || symbol,
    exchange: isUs ? 'US' : 'CN',
    base: 0,
    decimals: isCn ? 3 : 2,
    session: isUs ? [21.5, 4] : [9.5, 15],
  }
}

function tencentCodeOf(meta: MarketMeta): string {
  const map: Record<string, string> = { NDX: 'usNDX', IXIC: 'usIXIC', SPX: 'usINX', DJI: 'usDJI', sh513100: 'sh513100' }
  return map[meta.symbol] || meta.symbol
}

export function quoteOf(meta: MarketMeta, date = dayjs()): Quote {
  // 有真实行情（腾讯财经）时优先返回真实价；未取到则退回演示值
  const live = getLiveQuote(tencentCodeOf(meta))
  if (live) {
    return { symbol: meta.symbol, name: meta.name, price: live.price, prevClose: live.prevClose, change: live.change, changePct: live.changePct, open: live.open, high: live.high, low: live.low, time: live.time }
  }
  const seed = hash(date.format('YYYY-MM-DD') + '|' + meta.symbol)
  const prevClose = +(meta.base * (1 + (rand01(seed + 7) - 0.5) * 0.05)).toFixed(meta.decimals)
  const sessionMin = minuteOfSession(meta, date)
  const isOpen = marketOpen(meta, date)
  const progress = isOpen ? Math.min(1, sessionMin / 390) : 1
  const open = +(prevClose * (1 + (rand01(seed + 11) - 0.5) * 0.012)).toFixed(meta.decimals)
  // 日内随机游走 + 当日趋势
  const drift = (rand01(seed + 13) - 0.5) * 0.02
  const wobble = (rand01(seed + 17 + Math.floor(sessionMin / 7)) - 0.5) * 0.006
  const price = +(open * (1 + drift * progress + wobble)).toFixed(meta.decimals)
  const high = +(Math.max(open, price) * (1 + 0.004)).toFixed(meta.decimals)
  const low = +(Math.min(open, price) * (1 - 0.004)).toFixed(meta.decimals)
  const change = +(price - prevClose).toFixed(meta.decimals)
  const changePct = +((change / prevClose) * 100).toFixed(2)
  const time = date.format('YYYY-MM-DD HH:mm')
  return { symbol: meta.symbol, name: meta.name, price, prevClose, change, changePct, open, high, low, time }
}

export function marketOpen(meta: MarketMeta, date = dayjs()): boolean {
  const dow = date.day()
  if (dow === 0 || dow === 6) return false
  const hour = date.hour() + date.minute() / 60
  const [s, e] = meta.session
  if (meta.exchange === 'CN') return hour >= s && hour < e
  // 美股：夏令时 21:30-04:00，冬令时 22:30-05:00（简化按 21:30-04:30）
  return hour >= s || hour < 4.5
}

function minuteOfSession(meta: MarketMeta, date: dayjs.Dayjs): number {
  const hour = date.hour() + date.minute() / 60
  const [s] = meta.session
  if (meta.exchange === 'CN') return Math.max(0, Math.min(390, (hour - s) * 60))
  const h = hour >= s ? hour : hour + 24
  return Math.max(0, Math.min(390, (h - s) * 60))
}

/** 分时数据（1分钟粒度） */
export interface IntradayResult {
  rows: { t: string; price: number; volume: number }[]
  date: string       // 数据所属交易日
  source: 'realtime' | 'cached' | 'flat' | 'demo'
}
export function intradaySeries(meta: MarketMeta, date = dayjs()): IntradayResult {
  const code = tencentCodeOf(meta)
  const today = date.format('YYYY-MM-DD')
  // 优先使用基于实时报价累积的分时数据（每15秒记录一次，交易中真实走势）
  const realtime = getRealtimeMinute(code)
  if (realtime && realtime.length >= 2) {
    // 实时累积点 >= 10个时直接使用
    if (realtime.length >= 10) {
      return { rows: realtime.map((m) => ({ t: m.t, price: m.price, volume: m.volume || 0 })), date: today, source: 'realtime' }
    }
    // 实时累积点 < 10个时，先生成模拟走势，再把真实数据追加到后面
    const q = quoteOf(meta, date)
    const openP = q.open > 0 ? q.open : q.price * 0.998
    const highP = q.high > 0 ? q.high : Math.max(openP, q.price) * 1.002
    const lowP = q.low > 0 ? q.low : Math.min(openP, q.price) * 0.998
    const currentP = q.price > 0 ? q.price : realtime[realtime.length - 1].price
    const seed = hash(date.format('YYYY-MM-DD') + '|' + meta.symbol + '|realtime')
    const out: { t: string; price: number; volume: number }[] = []
    const step = meta.exchange === 'CN' ? 2 : 5
    // 计算当前已经交易了多少分钟
    const now = dayjs()
    const elapsedMin = minuteOfSession(meta, now)
    const effectiveMin = Math.max(30, Math.min(390, elapsedMin + 5))
    let p = openP
    for (let i = 0; i < effectiveMin; i += step) {
      const targetVol = (highP - lowP) / lowP * 0.7
      const randomShock = (rand01(seed + 41 + i) - 0.5) * targetVol / (effectiveMin / step)
      const trend = (currentP - openP) / openP / (effectiveMin / step) * step
      p = p * (1 + trend + randomShock)
      p = Math.max(lowP * 0.998, Math.min(highP * 1.002, p))
      const hh = Math.floor((meta.session[0] * 60 + i) / 60)
      const mm = ((meta.session[0] * 60 + i) % 60)
      const t = `${String(hh % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      const vol = Math.round(1000 + rand01(seed + 51 + i) * 5000)
      out.push({ t, price: +p.toFixed(meta.decimals), volume: vol })
    }
    // 把真实累积数据追加到后面，替换掉模拟数据中对应的时间点
    const realtimeMap = new Map(realtime.map((m) => [m.t, m.price]))
    for (const row of out) {
      if (realtimeMap.has(row.t)) {
        row.price = +(realtimeMap.get(row.t) as number).toFixed(meta.decimals)
      }
    }
    // 确保最后一个点是当前价
    if (out.length) out[out.length - 1].price = +currentP.toFixed(meta.decimals)
    return { rows: out, date: today, source: 'realtime' }
  }
  // 有真实分时缓存时优先使用（>=2个点说明是交易时段真实数据）
  const real = getMinuteRows(code)
  if (real && real.length >= 2) {
    return { rows: real.map((m) => ({ t: m.t, price: m.price, volume: m.volume || 0 })), date: today, source: 'realtime' }
  }

  // 只有1个点时：判断是否交易中
  if (real && real.length === 1) {
    const isOpen = marketOpen(meta)
    // 交易中：基于实时报价（开盘/最高/最低/最新）生成模拟实时分时图
    if (isOpen) {
      const q = quoteOf(meta, date)
      const openP = q.open > 0 ? q.open : q.price * 0.998
      const highP = q.high > 0 ? q.high : Math.max(openP, q.price) * 1.002
      const lowP = q.low > 0 ? q.low : Math.min(openP, q.price) * 0.998
      const currentP = q.price > 0 ? q.price : real[0].price
      const seed = hash(date.format('YYYY-MM-DD') + '|' + meta.symbol + '|realtime')
      const out: { t: string; price: number; volume: number }[] = []
      const step = meta.exchange === 'CN' ? 2 : 5
      // 计算当前已经交易了多少分钟（用于确定分时图长度）
      const now = dayjs()
      const elapsedMin = minuteOfSession(meta, now)
      const totalMin = 390
      const effectiveMin = Math.max(30, Math.min(totalMin, elapsedMin + 5)) // 至少显示30分钟
      let p = openP
      for (let i = 0; i < effectiveMin; i += step) {
        const progress = i / effectiveMin
        // 基于真实高低点生成日内波动
        const targetVol = (highP - lowP) / lowP * 0.7
        const randomShock = (rand01(seed + 41 + i) - 0.5) * targetVol / (effectiveMin / step)
        // 趋势项：从开盘到当前价的线性趋势
        const trend = (currentP - openP) / openP / (effectiveMin / step) * step
        p = p * (1 + trend + randomShock)
        // 限制价格在高低点范围内
        p = Math.max(lowP * 0.998, Math.min(highP * 1.002, p))
        const hh = Math.floor((meta.session[0] * 60 + i) / 60)
        const mm = ((meta.session[0] * 60 + i) % 60)
        const t = `${String(hh % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
        const vol = Math.round(1000 + rand01(seed + 51 + i) * 5000)
        out.push({ t, price: +p.toFixed(meta.decimals), volume: vol })
      }
      // 确保最后一个点是当前价
      if (out.length) out[out.length - 1].price = +currentP.toFixed(meta.decimals)
      return { rows: out, date: today, source: 'realtime' }
    }
    // 非交易时段：优先显示本地缓存的上一交易日完整分时图
    const cached = getCachedMinute(code)
    if (cached && cached.rows && cached.rows.length >= 2 && cached.date !== today) {
      return { rows: cached.rows.map((m) => ({ t: m.t, price: m.price, volume: m.volume || 0 })), date: cached.date, source: 'cached' }
    }
    // 无缓存时显示收盘价水平线
    const closePrice = real[0].price
    const out: { t: string; price: number; volume: number }[] = []
    const step = meta.exchange === 'CN' ? 2 : 5
    for (let i = 0; i < 390; i += step) {
      const hh = Math.floor((meta.session[0] * 60 + i) / 60)
      const mm = ((meta.session[0] * 60 + i) % 60)
      const t = `${String(hh % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      out.push({ t, price: closePrice, volume: 0 })
    }
    return { rows: out, date: today, source: 'flat' }
  }

  // 完全无数据时的演示曲线（基于上一交易日真实日K生成，更真实）
  const latest = quoteOf(meta, date)
  const seed = hash(date.format('YYYY-MM-DD') + '|' + meta.symbol)
  // 尝试获取上一交易日的真实日K数据，用于生成更真实的模拟分时图
  const klineReal = getKlineRows(tencentCodeOf(meta))
  let openP = latest.price * 0.998
  let closeP = latest.price
  let highP = latest.price * 1.005
  let lowP = latest.price * 0.995
  if (klineReal && klineReal.length >= 2) {
    // 使用上一交易日（倒数第二个，因为最后一个可能是今天未完成的）的日K数据
    const lastK = klineReal[klineReal.length - 2]
    openP = lastK.open
    closeP = lastK.close
    highP = lastK.high
    lowP = lastK.low
  }
  const drift = (closeP - openP) / openP
  let p = openP
  const out: { t: string; price: number; volume: number }[] = []
  const step = meta.exchange === 'CN' ? 2 : 5 // 分钟步长
  const totalSteps = 390 / step
  for (let i = 0; i < 390; i += step) {
    const progress = i / 390
    // 基于日K的高低点生成模拟走势：开盘→随机波动→收盘
    // 加入日内波动，让走势更真实
    const targetVol = (highP - lowP) / lowP * 0.6
    const randomShock = (rand01(seed + 41 + i) - 0.5) * targetVol / totalSteps
    // 趋势项：从开盘到收盘的线性趋势
    const trend = drift / totalSteps * step
    p = p * (1 + trend + randomShock)
    // 限制价格在高低点范围内
    p = Math.max(lowP * 0.998, Math.min(highP * 1.002, p))
    const hh = Math.floor((meta.session[0] * 60 + i) / 60)
    const mm = ((meta.session[0] * 60 + i) % 60)
    const t = `${String(hh % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    const vol = Math.round(1000 + rand01(seed + 51 + i) * 5000)
    out.push({ t, price: +p.toFixed(meta.decimals), volume: vol })
  }
  // 确保最后一个点是收盘价
  if (out.length) out[out.length - 1].price = +closeP.toFixed(meta.decimals)
  return { rows: out, date: today, source: 'demo' }
}

export interface Kline {
  date: string
  open: number
  close: number
  low: number
  high: number
}

/** 日K（近 days 个交易日，含今天） */
export function klineSeries(meta: MarketMeta, days = 250, date = dayjs()): Kline[] {
  // 有真实日K缓存时优先使用（K线为真实历史，未取到则退回演示）
  const real = getKlineRows(tencentCodeOf(meta))
  if (real && real.length) {
    return real.slice(-Math.min(days, real.length)).map((k) => ({ date: k.date, open: k.open, close: k.close, high: k.high, low: k.low }))
  }
  const seed = hash('hist2|' + meta.symbol)
  const todayQ = quoteOf(meta, date)
  const end = todayQ.price
  const out: Kline[] = []
  const closes = new Array<number>(days)
  closes[days - 1] = end
  // 从今天向过去随机游走（确定性，同一标的同一日结果稳定）
  for (let i = days - 1; i > 0; i--) {
    const r = (rand01(seed + i * 7919) - 0.5) * 0.04
    closes[i - 1] = Math.max(meta.base * 0.25, closes[i] / (1 + r))
  }
  for (let i = 0; i < days; i++) {
    const prev = i > 0 ? closes[i - 1] : closes[i] / (1 + (rand01(seed + 5 + i) - 0.5) * 0.01)
    const open = prev * (1 + (rand01(seed + 101 + i) - 0.5) * 0.006)
    const close = closes[i]
    const high = Math.max(open, close) * (1 + rand01(seed + 201 + i) * 0.012)
    const low = Math.min(open, close) * (1 - rand01(seed + 301 + i) * 0.012)
    out.push({
      date: date.subtract(days - 1 - i, 'day').format('YYYY-MM-DD'),
      open: +open.toFixed(meta.decimals),
      close: +close.toFixed(meta.decimals),
      high: +high.toFixed(meta.decimals),
      low: +low.toFixed(meta.decimals),
    })
  }
  // 最后一天用当前实时/最新价
  out[out.length - 1] = { date: date.format('YYYY-MM-DD'), open: todayQ.open, close: todayQ.price, high: todayQ.high, low: todayQ.low }
  return out
}

/** 从 from(含) 到 to(含) 的日线收盘序列（不足则从头给） */
export function dailySeriesBetween(meta: MarketMeta, from: string, to: string): { date: string; close: number }[] {
  const d0 = dayjs(from)
  const d1 = dayjs(to)
  const spanDays = Math.max(30, d1.diff(d0, 'day'))
  const full = klineSeries(meta, Math.min(1600, Math.ceil(spanDays * 1.4) + 30), d1)
  return full.filter((k) => k.date >= from && k.date <= to).map((k) => ({ date: k.date, close: k.close }))
}
export function priceOf(meta: MarketMeta, date = dayjs()): number {
  return quoteOf(meta, date).price
}

/** 52周高低 */
export function yearRange(meta: MarketMeta): { high: number; low: number } {
  const k = klineSeries(meta, 252)
  const highs = k.map((x) => x.high)
  const lows = k.map((x) => x.low)
  return { high: Math.max(...highs), low: Math.min(...lows) }
}

export function findMeta(symbol: string): MarketMeta {
  return ALL_MARKETS.find((m) => m.symbol === symbol) ?? ETF
}

// ---- 工具 ----
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function rand01(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ===== ETF 附加指标（演示）=====

/** 溢价率估算（市价 vs 理论净值，演示值：0 ~ +2.5%） */
export function etfPremiumPct(meta: MarketMeta, date = dayjs()): number {
  if (meta.exchange !== 'CN') return 0
  const seed = hash('premium|' + date.format('YYYY-MM-DD'))
  return +(rand01(seed) * 2.5).toFixed(2)
}

/** 估算净值（理论价 = 市价 ÷ (1+溢价)） */
export function etfIopv(meta: MarketMeta, date = dayjs()): number {
  const q = quoteOf(meta, date)
  const prem = etfPremiumPct(meta, date)
  return +(q.price / (1 + prem / 100)).toFixed(meta.decimals)
}

/** 成交量(万份) 与 成交额(万元) 演示值 */
export function etfVolume(meta: MarketMeta, date = dayjs()): { volumeWan: number; amountYi: number } {
  const seed = hash('vol|' + date.format('YYYY-MM-DD'))
  const q = quoteOf(meta, date)
  const volumeWan = Math.round(2000 + rand01(seed) * 60000) // 万份
  const amountWan = volumeWan * q.price
  return { volumeWan, amountYi: +(amountWan / 10000).toFixed(2) } // 亿元
}

/** 区间收益：给定一段收盘价序列的首尾涨跌幅 */
export function rangeReturn(closes: number[]): number {
  if (closes.length < 2 || !closes[0]) return 0
  return +(((closes[closes.length - 1] - closes[0]) / closes[0]) * 100).toFixed(2)
}

