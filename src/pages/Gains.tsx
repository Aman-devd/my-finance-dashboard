import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { investmentView, investmentTotals } from '../lib/values'
import { moneyShort } from '../lib/format'
import { seriesFromStart, investStart, yearlyReturns, drawdownAnalysis, holdingsShares } from '../lib/gains'
import { findMeta } from '../lib/market'
import { Button, Card, Field, PageHead, Tag, TextInput, cx } from '../components/ui'
import { EChart, lineOption } from '../components/charts'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function Gains() {
  const { data, setSettings } = useApp()
  const today = dayjs()
  const defaultStart = investStart(data)
  const [startDate, setStartDate] = useState(defaultStart)

  const views = useMemo(() => investmentView(data), [data])
  const totals = useMemo(() => investmentTotals(data), [data])
  const { shares } = holdingsShares(data)

  const pts = useMemo(() => seriesFromStart(data, startDate), [data, startDate])
  const years = useMemo(() => yearlyReturns(data, pts), [data, pts])
  const dd = useMemo(() => drawdownAnalysis(pts, shares), [pts, shares])

  const meta = findMeta('sh513100')
  const dates = pts.map((p) => p.date)
  const closes = pts.map((p) => p.close)

  // 价格走势 + B/S 买卖点
  const priceOpt = useMemo(() => {
    const opt = lineOption(dates, [{ name: `${meta.name} 价格`, data: closes.map((c) => +c.toFixed(meta.decimals)), color: '#2563eb' }], { yFmt: (v) => v.toFixed(3) }) as unknown as { series: { markPoint?: unknown }[] }
    const idx = new Map(dates.map((d, i) => [d, i]))
    const points = data.trades
      .filter((t) => idx.has(t.date))
      .map((t) => ({ coord: [idx.get(t.date)!, closes[idx.get(t.date)!]], value: t.side === 'buy' ? 'B' : 'S', itemStyle: { color: t.side === 'buy' ? '#dc2626' : '#16a34a' }, symbol: 'circle', symbolSize: 11, borderWidth: 2, borderColor: '#fff', label: { show: true, formatter: t.side === 'buy' ? 'B' : 'S', color: t.side === 'buy' ? '#dc2626' : '#16a34a', fontSize: 9, position: 'right' as const, distance: 2 } }))
    if (opt.series?.[0]) (opt.series[0] as { markPoint?: unknown }).markPoint = { data: points }
    return opt as never
  }, [dates, closes, data.trades])

  const ddOpt = useMemo(() => {
    if (!dd) return null
    return lineOption(dd.series.map((s) => s.date), [{ name: '回撤', data: dd.series.map((s) => s.ddPct), color: '#ef4444', area: true }], { yFmt: (v) => v.toFixed(1) + '%' })
  }, [dd])

  const thisYear = years.find((y) => y.year === today.year())
  const lastYear = years.find((y) => y.year === today.year() - 1)
  const prevYear = years.find((y) => y.year === today.year() - 2)
  const saveStart = () => { setSettings({ investStartDate: startDate }) }

  const fm = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

  if (!shares || totals.cost <= 0) {
    return <Card className="p-8 text-center text-slate-400 text-sm">还没有持仓数据，先去「账户/持仓」录入纳指ETF 份额与平均成本</Card>
  }

  return (
    <div className="space-y-5">
      <PageHead title="收益分析" sub={`自 ${startDate} 记录以来 · 当前持仓 ¥${fm(totals.cost)}`} />


      {/* 总览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Mini label="当前市值" value={`¥${moneyShort(totals.mv)}`} />
        <Mini label="累计收益(自开始)" value={`${totals.pnl >= 0 ? '+' : ''}¥${moneyShort(totals.pnl)}`} tone={totals.pnl >= 0 ? 'up' : 'down'} />
        <Mini label="累计收益率" value={pct(totals.pnlPct)} tone={totals.pnl >= 0 ? 'up' : 'down'} />
        <Mini label="历史最大回撤" value={dd ? `-${dd.pct.toFixed(2)}%` : '--'} tone="down" sub={dd ? `${dd.peakDate} → ${dd.troughDate}` : undefined} />
      </div>

      {/* 今年/去年/前年 */}
      <div className="grid grid-cols-3 gap-2">
        <YearChip label="今年" y={thisYear} />
        <YearChip label="去年" y={lastYear} />
        <YearChip label="前年" y={prevYear} />
      </div>

      {/* 走势 + B/S */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-1">纳指100ETF 走势（▲B 买入 · ▼S 卖出）</div>
        <div className="text-[11px] text-slate-400 mb-2">{dates.length} 个交易日 · 自 {startDate} 至 {today.format('YYYY-MM-DD')}</div>
        <EChart option={priceOpt} height={280} />
      </Card>

      {/* 回撤 */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-1">历史回撤分析</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <div className="rounded-xl bg-red-50 p-2.5 text-center"><div className="text-[10px] text-slate-400">最大回撤</div><div className="font-bold text-red-500 num">-{dd?.pct.toFixed(2) ?? '--'}%</div></div>
          <div className="rounded-xl bg-red-50 p-2.5 text-center"><div className="text-[10px] text-slate-400">回撤金额(按当前份额)</div><div className="font-bold text-red-500 num">¥{moneyShort(dd?.amount || 0)}</div></div>
          <div className="rounded-xl bg-red-50 p-2.5 text-center"><div className="text-[10px] text-slate-400">高峰→低谷</div><div className="font-bold text-red-500 num text-xs pt-1">{dd ? `${dd.peakDate.slice(5)}→${dd.troughDate.slice(5)}` : '--'}</div></div>
        </div>
        {ddOpt && <EChart option={ddOpt} height={200} />}
      </Card>

      {/* 逐年收益表 */}
      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-1 text-sm font-semibold">逐年收益（自记录起）</div>
        <div className="px-4 text-[11px] text-slate-400 pb-2">以每年收盘价计算：收益 = 份额 ×（年末价 − 上年末价）</div>
        <div className="divide-y divide-slate-50">
          {[...years].reverse().map((y) => {
            const maxAbs = Math.max(...years.map((r) => Math.abs(r.pnl)), 1)
            return (
              <div key={y.year} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 font-bold num">{y.year}</div>
                  <div className="flex-1">
                    <div className="flex items-end justify-between text-xs">
                      <span className="text-slate-400 num">¥{y.startPrice.toFixed(3)} → ¥{y.endPrice.toFixed(3)}</span>
                      <span className={cx('num font-bold', y.pnl >= 0 ? 'text-red-500' : 'text-emerald-600')}>{y.pnl >= 0 ? '+' : ''}{fm(y.pnl)}（{pct(y.pnlPct)}）</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                      <div className={cx('h-full', y.pnl >= 0 ? 'bg-red-500' : 'bg-emerald-400')} style={{ width: `${Math.min(100, Math.abs(y.pnl) / maxAbs * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div className="px-4 py-3 bg-slate-50/60 flex items-center justify-between text-sm">
            <span className="font-semibold">累计（相对成本）</span>
            <span className={cx('num font-bold', totals.pnl >= 0 ? 'text-red-500' : 'text-emerald-600')}>{totals.pnl >= 0 ? '+' : ''}¥{fm(totals.pnl)}（{pct(totals.pnlPct)}）</span>
          </div>
        </div>
      </Card>
      {/* 记录起始日设置 */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">记录起始日设置</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Field label="投资累计收益从哪天开始记录"><TextInput type="date" value={startDate} max={today.format('YYYY-MM-DD')} onChange={(e) => setStartDate(e.target.value || defaultStart)} /></Field>
          </div>
          <Button variant="outline" onClick={saveStart}>保存并应用</Button>
          <Button variant="soft" onClick={() => { setStartDate(defaultStart); setSettings({ investStartDate: defaultStart }) }}>按最早交易日</Button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">默认取「最早一笔交易日期」；没补录历史交易时可手动改成真正开始记录的日期。收益按当前份额 × 当日价格估算，逐年累计。</p>
      </Card>    </div>
  )
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={cx('text-base md:text-lg font-bold num mt-0.5', tone === 'up' ? 'text-red-500' : tone === 'down' ? 'text-emerald-600' : 'text-slate-800')}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5 num">{sub}</div>}
    </Card>
  )
}

function YearChip({ label, y }: { label: string; y?: { pnl: number; pnlPct: number } }) {
  const up = (y?.pnl ?? 0) >= 0
  return (
    <Card className="p-3 flex items-center gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex-1 text-right">
        {y ? (
          <div>
            <div className={cx('num font-bold text-sm', up ? 'text-red-500' : 'text-emerald-600')}>{up ? '▲' : '▼'} {y.pnlPct.toFixed(2)}%</div>
            <div className={cx('num text-[10px]', up ? 'text-emerald-500' : 'text-red-400')}>{up ? '+' : ''}{y.pnl.toLocaleString()}</div>
          </div>
        ) : <div className="text-slate-300 text-xs">未记录</div>}
      </div>
    </Card>
  )
}










