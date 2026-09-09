import { useEffect, useState } from 'react'

// ===== 真实行情：腾讯财经（免费）=====
// 每 15 秒自动刷新一次；页面不可见时暂停拉取，回到前台立即刷新。

export interface LiveQuote {
  symbol: string
  price: number
  prevClose: number
  open: number
  high: number
  low: number
  change: number
  changePct: number
  time: string
}

const CODES = new Set(['usNDX', 'usIXIC', 'usINX', 'usDJI', 'sh513100'])
function buildUrl() { return 'https://qt.gtimg.cn/q=' + [...CODES].join(',') }

const cache = new Map<string, LiveQuote>()
let started = false
const subs = new Set<() => void>()

/** 动态添加标的到行情轮询列表（用于用户持仓的非默认标的） */
export function addQuoteSymbol(code: string): void {
  if (!CODES.has(code)) {
    CODES.add(code)
    // 立即刷新一次行情
    void refreshQuotes()
  }
}

function notify() {
  for (const fn of [...subs]) { try { fn() } catch { /* ignore */ } }
}

export function subscribeQuotes(fn: () => void): () => void {
  subs.add(fn)
  return () => { subs.delete(fn) }
}

function parse(text: string) {
  const re = /v_(\w+)="([^"]*)"/g
  const fresh = new Map<string, LiveQuote>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const code = m[1]
    const a = m[2].split('~')
    if (a.length < 35) continue
    const num = (i: number) => { const v = parseFloat(a[i]); return Number.isFinite(v) ? v : 0 }
    fresh.set(code, {
      symbol: code,
      price: num(3),
      prevClose: num(4),
      open: num(5),
      high: num(33),
      low: num(34),
      change: num(31),
      changePct: num(32),
      time: (a[30] || '').trim(),
    })
  }
  if (fresh.size) {
    for (const [k, v] of fresh) cache.set(k, v)
    notify()
  }
}

export async function refreshQuotes(): Promise<void> {
  try {
    const r = await fetch(buildUrl(), { cache: 'no-store' })
    const buffer = await r.arrayBuffer()
    let text: string
    try {
      text = new TextDecoder('gbk').decode(buffer)
    } catch {
      text = new TextDecoder('utf-8').decode(buffer)
    }
    parse(text)
  } catch { /* 网络异常静默，下一轮自动重试 */ }
}

/** 启动后台轮询（幂等） */
export function startQuotes(): void {
  if (started) return
  started = true
  void refreshQuotes()
  window.setInterval(() => { if (!document.hidden) void refreshQuotes() }, 15000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshQuotes() })
}

export function getLiveQuote(code: string): LiveQuote | undefined {
  return cache.get(code)
}

/** 单独查询某个标的的实时行情（用于用户输入代码后自动查找） */
export async function fetchQuoteByCode(code: string): Promise<{ quote: LiveQuote; name: string } | null> {
  try {
    const url = 'https://qt.gtimg.cn/q=' + code
    const r = await fetch(url, { cache: 'no-store' })
    // 腾讯财经接口返回 GBK 编码，需要用 TextDecoder 解码
    const buffer = await r.arrayBuffer()
    let text: string
    try {
      text = new TextDecoder('gbk').decode(buffer)
    } catch {
      text = new TextDecoder('utf-8').decode(buffer)
    }
    const re = /v_(\w+)="([^"]*)"/g
    const m = re.exec(text)
    if (!m) return null
    const a = m[2].split('~')
    if (a.length < 35) return null
    const num = (i: number) => { const v = parseFloat(a[i]); return Number.isFinite(v) ? v : 0 }
    const quote: LiveQuote = {
      symbol: m[1],
      price: num(3),
      prevClose: num(4),
      open: num(5),
      high: num(33),
      low: num(34),
      change: num(31),
      changePct: num(32),
      time: (a[30] || '').trim(),
    }
    const name = (a[1] || '').trim()
    if (quote.price <= 0) return null
    // 缓存起来，后续轮询也能用到
    cache.set(m[1], quote)
    return { quote, name }
  } catch {
    return null
  }
}

/** 让使用真实行情的组件在每次刷新后重新渲染；返回刷新计数 */
export function useLiveQuotes(): number {
  const [n, set] = useState(0)
  useEffect(() => {
    startQuotes()
    startKlines()
    startMinutes()
    const un = subscribeQuotes(() => set((v) => v + 1))
    return un
  }, [])
  return n
}


// ===== 真实日K：腾讯财经 =====
export interface KlineRow { date: string; open: number; close: number; high: number; low: number }
const kCache = new Map<string, { at: number; rows: KlineRow[] }>()
let kStarted = false
const KL_COUNT = 430

async function fetchKline(code: string): Promise<KlineRow[] | null> {
  const isUs = code.startsWith('us')
  const url = isUs
    ? 'https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get?param=' + code + ',day,,,' + KL_COUNT + ',qfq'
    : 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=' + code + ',day,,,' + KL_COUNT + ',qfq'
  const r = await fetch(url, { cache: 'no-store' })
  const j = await r.json()
  const node = j && j.data && j.data[code]
  const arr = (node && (node.day || node.qfqday)) as unknown[] | undefined
  if (!Array.isArray(arr) || !arr.length) return null
  const rows: KlineRow[] = []
  for (const it of arr) {
    if (!Array.isArray(it) || it.length < 5) continue
    const date = String(it[0]); const open = parseFloat(it[1] as string); const close = parseFloat(it[2] as string); const high = parseFloat(it[3] as string); const low = parseFloat(it[4] as string)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(open)) continue
    rows.push({ date, open, close, high, low })
  }
  return rows.length ? rows : null
}

/** 拉取全部 5 个标的的真实日K并缓存；完成后通知订阅者刷新界面 */
export async function refreshKlines(): Promise<void> {
  let changed = false
  for (const code of CODES) {
    try {
      const rows = await fetchKline(code)
      if (rows && rows.length) { kCache.set(code, { at: Date.now(), rows }); changed = true }
    } catch { /* 单个标的失败不影响其它 */ }
  }
  if (changed) notify()
}

export function getKlineRows(code: string): KlineRow[] | undefined {
  return kCache.get(code)?.rows
}

/** 启动日K预取（幂等；页面打开后立即拉一次，之后每 30 分钟刷新） */
export function startKlines(): void {
  if (kStarted) return
  kStarted = true
  void refreshKlines()
  window.setInterval(() => { if (!document.hidden) void refreshKlines() }, 30 * 60 * 1000)
}


// ===== 真实分时（A股 513100 + 美股指数，盘中）=====
export interface MinuteRow { t: string; price: number; volume: number }
export interface CachedMinute { date: string; rows: MinuteRow[] }
const mCache = new Map<string, { at: number; rows: MinuteRow[] }>()
let mStarted = false
const MINUTE_URL_BASE = 'https://web.ifzq.gtimg.cn/appstock/app/minute/query?code='
const MINUTE_CACHE_KEY = 'finance.app.minute.v1'

/** 读取本地缓存的历史分时数据（用于非交易时段显示上一交易日分时图） */
export function getCachedMinute(code: string): CachedMinute | null {
  try {
    const raw = localStorage.getItem(MINUTE_CACHE_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, CachedMinute>
    return all[code] || null
  } catch { return null }
}

/** 写入本地缓存的分时数据（仅在交易时段获取到完整数据时写入） */
function writeCachedMinute(code: string, rows: MinuteRow[]) {
  try {
    const raw = localStorage.getItem(MINUTE_CACHE_KEY)
    const all = raw ? JSON.parse(raw) as Record<string, CachedMinute> : {}
    const today = new Date().toISOString().slice(0, 10)
    all[code] = { date: today, rows }
    localStorage.setItem(MINUTE_CACHE_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

async function fetchMinute(code: string): Promise<MinuteRow[] | null> {
  try {
    const r = await fetch(MINUTE_URL_BASE + code, { cache: 'no-store' })
    const j = await r.json()
    const node = j && j.data && j.data[code] && j.data[code].data
    const arr = node && node.data
    if (!Array.isArray(arr)) return null
    const rows: MinuteRow[] = []
    for (const raw of arr) {
      const p = String(raw).split(' ')
      if (p.length >= 2) {
        const hm = p[0]
        const t = hm.length === 4 ? hm.slice(0, 2) + ':' + hm.slice(2) : hm
        const price = parseFloat(p[1])
        const volume = p.length >= 3 ? parseFloat(p[2]) || 0 : 0
        if (t && Number.isFinite(price)) rows.push({ t, price, volume })
      }
    }
    return rows.length ? rows : null
  } catch { return null }
}

export async function refreshMinutes(): Promise<void> {
  // 拉取全部 5 个标的的分时数据（4 个美股指数 + A股 513100）
  // 交易时段返回完整 1 分钟粒度；非交易时段仅返回收盘价(1个点)，此时显示收盘价水平线
  let changed = false
  for (const code of CODES) {
    try {
      const rows = await fetchMinute(code)
      if (!rows || !rows.length) continue
      const old = mCache.get(code)
      // 数据点数量变化、或首尾价格变化时，视为有更新
      const priceChanged = !old || old.rows.length !== rows.length ||
        old.rows[0]?.price !== rows[0]?.price ||
        old.rows[old.rows.length - 1]?.price !== rows[rows.length - 1]?.price
      if (priceChanged) {
        mCache.set(code, { at: Date.now(), rows })
        changed = true
        // 交易时段（>=2个点）时缓存到 localStorage，供非交易时段显示上一交易日分时图
        if (rows.length >= 2) writeCachedMinute(code, rows)
      }
    } catch { /* 单个标的失败不影响其它 */ }
  }
  if (changed) notify()
}

export function getMinuteRows(code: string): MinuteRow[] | undefined {
  return mCache.get(code)?.rows
}

export function startMinutes(): void {
  if (mStarted) return
  mStarted = true
  void refreshMinutes()
  window.setInterval(() => { if (!document.hidden) void refreshMinutes() }, 60000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshMinutes() })
}
