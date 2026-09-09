import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../lib/store'
import { useLiveQuotes } from '../lib/quotes'
import { investmentView } from '../lib/values'
import dayjs from 'dayjs'
import { INDICES, ETF, quoteOf, intradaySeries, klineSeries, yearRange, findMeta, marketOpen } from '../lib/market'
import { Card, PageHead, Segmented, Tag, Button, cx } from '../components/ui'
import { EChart, areaOption, candleOption, lineOption, intradayOption } from '../components/charts'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'

type Tab = 'kline' | 'intraday' | 'trend' | 'compare'
type Range = '1M' | '3M' | '1Y' | 'ALL'
type Pair = 'etf-ndx' | 'ndx-spx'

const DAYS: Record<Range, number> = { '1M': 22, '3M': 66, '1Y': 250, 'ALL': 400 }

export default function Markets() {
  const [active, setActive] = useState('NDX')
  const [tab, setTab] = useState<Tab>('intraday')
  const [range, setRange] = useState<Range>('3M')
  const [pair, setPair] = useState<Pair>('etf-ndx')
  const [tick, setTick] = useState(0)
  const liveTick = useLiveQuotes()

  const { data } = useApp()
  const views = useMemo(() => investmentView(data), [data, liveTick])
  const meta = findMeta(active)
  const q = useMemo(() => quoteOf(meta), [meta, tick, liveTick])
  const intraday = useMemo(() => intradaySeries(meta), [meta, tick, liveTick])
  const kline = useMemo(() => klineSeries(meta, 400), [meta, tick, liveTick])
  const yr = useMemo(() => yearRange(meta), [meta, tick])
  const open = marketOpen(meta)

  const openSymbol = (sym: string) => {
    setActive(sym)
    setTab('intraday')
    setTimeout(() => {
      const el = document.getElementById('symbol-detail')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }
  const isETF = meta.exchange === 'CN'

  const days = DAYS[range]
  const sliced = kline.slice(-days)
  const dates = sliced.map((k) => k.date)
  const ohlc = sliced.map((k) => [k.open, k.close, k.low, k.high] as [number, number, number, number])
  const closeArr = sliced.map((k) => k.close)
  const segDates = sliced.map((k) => k.date)

  // 走势折线（单标的）
  const trendSeries: { name: string; data: number[]; color?: string; area?: boolean }[] = [{ name: meta.name, data: closeArr, color: '#2563eb', area: true }]

  // 归一化对比：起始 = 100
  const norm = (arr: number[]) => {
    const base = arr[0] || 1
    return arr.map((v) => +((v / base) * 100).toFixed(2))
  }
  const compareSeries = useMemo(() => {
    if (pair === 'etf-ndx') {
      const etfK = klineSeries(ETF, 400).slice(-days)
      const ndxK = klineSeries(INDICES[0], 400).slice(-days)
      return [
        { name: '国内纳指ETF(513100)', data: norm(etfK.map((k) => k.close)), color: '#2563eb' },
        { name: '美股纳指100', data: norm(ndxK.map((k) => k.close)), color: '#f59e0b' },
      ]
    }
    const ndxK = klineSeries(INDICES[0], 400).slice(-days)
    const spxK = klineSeries(INDICES[2], 400).slice(-days)
    return [
      { name: '纳斯达克100', data: norm(ndxK.map((k) => k.close)), color: '#2563eb' },
      { name: '标普500', data: norm(spxK.map((k) => k.close)), color: '#10b981' },
    ]
  }, [pair, days, tick])

  return (
    <div className="space-y-5">
      <PageHead title="美股四大指数 · 纳指ETF" sub="行情与日K来自腾讯财经 · 15 秒刷新（交易时段为真实分时）" right={<Button variant="outline" onClick={() => setTick((t) => t + 1)}><RefreshCw size={15} /> 刷新</Button>} />

      {/* 四大指数卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {INDICES.map((m) => {
          const qq = quoteOf(m)
          const up = qq.changePct >= 0
          return (
            <button key={m.symbol} onClick={() => { setActive(m.symbol); setTab('intraday') }} className={cx('rounded-2xl p-3.5 text-left border bg-white shadow-sm transition', active === m.symbol ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-100')}>
              <div className="text-xs text-slate-500">{m.name}</div>
              <div className="text-lg font-bold num mt-0.5">{qq.price.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
              <div className={cx('text-xs num font-medium', up ? 'text-red-500' : 'text-emerald-600')}>{up ? '▲' : '▼'} {qq.changePct >= 0 ? '+' : ''}{qq.changePct.toFixed(2)}%</div>
            </button>
          )
        })}
      </div>

      {/* 我的持仓（美股指数下方，多账户/多标的逐条展示） */}
      {views.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-slate-500">我的持仓</h3>
            <Link to="/holdings" className="text-xs text-blue-600 shrink-0">全部持仓</Link>
          </div>
          <div className="text-[11px] text-slate-400 mb-1">共 {views.length} 笔 · 点击某行查看行情详情</div>
          <div className="divide-y divide-slate-100">
            {views.map((v) => {
              const acc = data.accounts.find((a) => a.id === v.accountId)?.name || '证券账户'
              return (
                <button key={v.id} onClick={() => openSymbol(v.symbol)} className="w-full flex items-center gap-3 py-2.5 text-left hover:opacity-80">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 grid place-items-center text-[10px] font-bold shrink-0">ETF</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{v.name} <span className="text-slate-300 text-[11px]">{v.symbol}</span></div>
                    <div className="text-[11px] text-slate-400 truncate">{acc} · {v.shares.toLocaleString()} 份 · 成本 ¥{v.avgCost.toFixed(3)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="num font-semibold text-sm">¥{v.mv.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</div>
                    <div className={cx('num text-[11px]', v.pnl >= 0 ? 'text-red-500' : 'text-emerald-600')}>{v.pnl >= 0 ? '+' : ''}{v.pnl.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}（{v.pnlPct.toFixed(2)}%）</div>
                  </div>
                  
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* 详情 */}
      <Card className="p-4">
        <div id="symbol-detail" className="flex scroll-mt-24 flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold">{meta.name} <span className="text-xs font-normal text-slate-400">{meta.symbol}{meta.exchange === 'CN' ? ' · 上交所' : ''}</span></h2>
              <Tag tone={open ? 'green' : 'slate'}>{open ? '交易中' : '休市'}</Tag>
              {isETF && <Tag tone="blue">场内基金</Tag>}
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-3xl font-bold num">{q.price.toLocaleString('zh-CN', { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals })}</span>
              <span className={cx('text-sm num font-semibold mb-1', q.changePct >= 0 ? 'text-red-500' : 'text-emerald-600')}>{q.changePct >= 0 ? <TrendingUp size={14} className="inline" /> : <TrendingDown size={14} className="inline" />}{q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 text-right leading-5 num">
            今开 {q.open.toLocaleString()}<br />最高 {q.high.toLocaleString()} · 最低 {q.low.toLocaleString()}<br />52周高 {yr.high.toLocaleString()} · 低 {yr.low.toLocaleString()}
          </div>
        </div>

        <Segmented options={[{ value: 'intraday', label: '分时' }, { value: 'kline', label: '日K' }, { value: 'trend', label: '走势' }, { value: 'compare', label: '对比' }]} value={tab} onChange={(v) => setTab(v as Tab)} />

        <div className="mt-3">
          {tab === 'kline' && (
            <>
              <div className="flex justify-end mb-1"><RangeBtns range={range} onChange={setRange} /></div>
              <EChart option={candleOption(dates, ohlc)} height={340} />
            </>
          )}
          {tab === 'intraday' && (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] text-slate-400">
                  {intraday.source === 'realtime' && <span className="text-emerald-600">● 交易中 · 实时分时</span>}
                  {intraday.source === 'cached' && <span className="text-amber-600">● 上一交易日 {intraday.date} 分时（当前休市）</span>}
                  {intraday.source === 'flat' && <span className="text-slate-400">● 收盘价水平线（休市，暂无历史分时缓存）</span>}
                  {intraday.source === 'demo' && <span className="text-slate-400">● 演示分时曲线</span>}
                </div>
              </div>
              <EChart option={intradayOption(intraday.rows.map((p) => p.t), intraday.rows.map((p) => p.price), intraday.rows.map((p) => p.volume || 0))} height={340} />
            </>
          )}
          {tab === 'trend' && (
            <>
              <div className="flex justify-end mb-1"><RangeBtns range={range} onChange={setRange} /></div>
              <EChart option={lineOption(segDates, trendSeries, { yFmt: (v) => v.toLocaleString() })} height={300} />
            </>
          )}
          {tab === 'compare' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <Segmented options={[{ value: 'etf-ndx', label: '国内纳指ETF vs 美股纳指' }, { value: 'ndx-spx', label: '纳指 vs 标普' }]} value={pair} onChange={(v) => setPair(v as Pair)} />
                <RangeBtns range={range} onChange={setRange} />
              </div>
              <p className="text-[11px] text-slate-400 mb-1">起点归一为 100，对比区间涨跌表现（起点不同不影响走势形状）</p>
              <EChart option={lineOption(segDates, compareSeries, { yFmt: (v) => v.toFixed(1) })} height={320} />
            </>
          )}
        </div>
        <div className="text-[10px] text-slate-300 mt-2">行情数据来自腾讯财经免费接口，报价/日K/交易时段分时为真实数据；非交易时段分时为演示曲线。</div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <Link to="/holdings"><Card className="p-4 text-sm font-medium hover:bg-slate-50">查看我的持仓与盈亏</Card></Link>
        <Link to="/tools"><Card className="p-4 text-sm font-medium hover:bg-slate-50">复利计算器等工具</Card></Link>
      </div>
    </div>
  )
}

function RangeBtns({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex gap-1">{(['1M', '3M', '1Y', 'ALL'] as Range[]).map((r) => <button key={r} onClick={() => onChange(r)} className={cx('text-[11px] px-2 py-0.5 rounded-md', range === r ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-400')}>{r}</button>)}</div>
  )
}








