import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { moneyShort } from '../lib/format'
import { useApp } from '../lib/store'
import { investmentView, investmentTotals } from '../lib/values'
import { findMeta, quoteOf, klineSeries } from '../lib/market'
import { Button, Card, Empty, Field, Modal, PageHead, Select, Segmented, TextInput, Tag, cx } from '../components/ui'
import { EChart, lineOption, barOption, pieOption } from '../components/charts'
import { Plus, TrendingUp, TrendingDown, Trash2 } from 'lucide-react'
import type { NewTrade } from '../lib/store'

export default function Holdings() {
  const { data, applyTrade } = useApp()
  const secAccounts = data.accounts.filter((a) => a.category === 'securities')
  const [accId, setAccId] = useState(secAccounts[0]?.id || '')
  const [open, setOpen] = useState(false)

  const views = useMemo(() => investmentView(data), [data])
  const totals = useMemo(() => investmentTotals(data), [data])
  const myHoldings = views.filter((v) => v.accountId === accId)
  const myTrades = data.trades.filter((t) => t.accountId === accId).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30)

  // ETF 走势 + 买卖点
  const chart = useMemo(() => {
    const meta = findMeta('sh513100')
    const k = klineSeries(meta, 90)
    const dates = k.map((x) => x.date)
    const closes = k.map((x) => x.close)
    const opt = lineOption(dates, [{ name: meta.name, data: closes, color: '#2563eb' }], { yFmt: (v) => v.toFixed(3) }) as unknown as { series: { markPoint?: unknown }[] }
    const points = myTrades
      .filter((t) => dates.includes(t.date))
      .map((t) => ({ coord: [dates.indexOf(t.date), t.price], value: t.side === 'buy' ? '买' : '卖', itemStyle: { color: t.side === 'buy' ? '#dc2626' : '#16a34a' }, symbol: 'circle', symbolSize: 11, borderWidth: 2, borderColor: '#fff', label: { show: true, formatter: t.side === 'buy' ? '买' : '卖', color: t.side === 'buy' ? '#dc2626' : '#16a34a', fontSize: 9, position: 'right' as const, distance: 2 } }))
    if (opt.series && opt.series[0]) (opt.series[0] as { markPoint?: unknown }).markPoint = { data: points, symbolOffset: [0, -4] }
    return { option: opt as never, dates, closes }
  }, [myTrades, data])

  const fm = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
  const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

  if (secAccounts.length === 0) {
    return <Card className="p-6"><Empty text="还没有证券账户，请先到「账户」添加" /></Card>
  }

  return (
    <div className="space-y-5">
      <PageHead title="持仓与盈亏" sub="份额 × 最新价 = 市值（行情来自腾讯财经）" right={<Button onClick={() => setOpen(true)}><Plus size={16} /> 记录买卖</Button>} />

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center"><div className="text-[11px] text-slate-400">投入成本</div><div className="num font-bold mt-0.5">¥{moneyShort(totals.cost)}</div></Card>
        <Card className="p-3 text-center"><div className="text-[11px] text-slate-400">当前市值</div><div className="num font-bold mt-0.5 text-blue-600">¥{moneyShort(totals.mv)}</div></Card>
        <Card className="p-3 text-center"><div className="text-[11px] text-slate-400">浮动盈亏</div><div className={cx('num font-bold mt-0.5', totals.pnl >= 0 ? 'text-red-500' : 'text-emerald-600')}>{moneyShort(totals.pnl)}</div></Card>
      </div>

      {/* 两账户综合分析 */}
      {(() => {
        const accStats = secAccounts.map((a) => {
          const hs = views.filter((v) => v.accountId === a.id)
          const cost = hs.reduce((s, v) => s + v.cost, 0)
          const mv = hs.reduce((s, v) => s + v.mv, 0)
          return { name: a.name, cost, mv, pnl: mv - cost, pnlPct: cost > 0 ? ((mv - cost) / cost) * 100 : 0, cash: a.balance, count: hs.length }
        })
        const k90 = klineSeries(findMeta('sh513100'), 90)
        const comboDates = k90.map((x) => x.date)
        const comboValues = k90.map((kk) => views.reduce((s, v) => s + v.shares * kk.close, 0))
        const totalCost = accStats.reduce((s, a) => s + a.cost, 0)
        const totalMv = accStats.reduce((s, a) => s + a.mv, 0)
        return (
          <Card className="p-4">
            <div className="text-sm font-semibold mb-1">两账户综合分析</div>
            <div className="text-[11px] text-slate-400 mb-3">合并 {accStats.length} 个证券账户 · 持仓成本 ¥{fm(totalCost)} · 市值 ¥{fm(totalMv)} · 盈亏 ¥{fm(totalMv - totalCost)}（{pct(totalCost ? ((totalMv - totalCost) / totalCost) * 100 : 0)}）</div>
            {accStats.length === 0 ? <div className="text-xs text-slate-300 py-3">暂无持仓数据</div> : (
              <>
                <div className="grid sm:grid-cols-2 gap-3 mb-2">
                  {accStats.map((a) => (
                    <div key={a.name} className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500 truncate">{a.name}（{a.count} 只持仓）</div>
                      <div className="flex justify-between items-end mt-1">
                        <span className="num font-bold text-lg">{fm(a.mv)}</span>
                        <span className={cx('num text-xs font-semibold', a.pnl >= 0 ? 'text-red-500' : 'text-emerald-600')}>{a.pnl >= 0 ? '+' : ''}{fm(a.pnl)}（{pct(a.pnlPct)}）</span>
                      </div>
                      <div className="text-[10px] text-slate-400 num mt-0.5">成本 ¥{fm(a.cost)} · 可用现金 ¥{fm(a.cash)}</div>
                    </div>
                  ))}
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">成本 vs 市值（按账户）</div>
                    <EChart option={barOption(accStats.map((a) => a.name), [
                      { name: '成本', data: accStats.map((a) => Math.round(a.cost)), color: '#94a3b8' },
                      { name: '市值', data: accStats.map((a) => Math.round(a.mv)), color: '#8b5cf6' },
                    ])} height={200} />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">市值占比</div>
                    <EChart option={pieOption(accStats.map((a) => ({ name: a.name, value: Math.round(a.mv), color: a.mv >= 0 ? '#8b5cf6' : '#94a3b8' })), { donut: true })} height={200} />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[11px] text-slate-400 mb-1">两账户合并市值走势（近 90 日，按当前持仓估算）</div>
                  <EChart option={lineOption(comboDates, [{ name: '合并市值', data: comboValues.map((v) => Math.round(v)), color: '#8b5cf6', area: true }], { yFmt: (v) => (v / 10000).toFixed(1) + '万' })} height={200} />
                </div>
              </>
            )}
          </Card>
        )
      })()}
      <div className="flex gap-2 items-center">
        <Select value={accId} onChange={(e) => setAccId(e.target.value)} className="!w-auto">
          {secAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <span className="text-xs text-slate-400">切换到账户查看明细与买卖点</span>
      </div>

      {/* 走势 + 买卖点 */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">纳指100ETF 走势与买卖点</h3>
          <span className="text-[10px] text-slate-300">近 90 个交易日</span>
        </div>
        <EChart option={chart.option} height={240} />
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-2 text-sm font-semibold">当前持仓</div>
        {myHoldings.length === 0 && <div className="px-4 pb-4"><Empty text="该账户暂无持仓，记录一笔买入吧" /></div>}
        <div className="divide-y divide-slate-50">
          {myHoldings.map((h) => (
            <div key={h.id} className="px-4 py-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 grid place-items-center text-xs font-bold">ETF</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{h.name} <span className="text-[10px] text-slate-400">{h.symbol}</span></div>
                <div className="text-[11px] text-slate-400 num">持仓 {h.shares.toLocaleString()} 份 · 成本 ¥{h.avgCost.toFixed(3)} · 现价 ¥{h.price.toFixed(3)}</div>
              </div>
              <div className="text-right">
                <div className="font-bold num">¥{fm(h.mv)}</div>
                <div className={cx('text-xs num font-medium', h.pnl >= 0 ? 'text-red-500' : 'text-emerald-600')}>{h.pnl >= 0 ? '+' : ''}{fm(h.pnl)}（{pct(h.pnlPct)}）</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-2 text-sm font-semibold">买卖点记录（近 30 笔）</div>
        {myTrades.length === 0 ? <div className="px-4 pb-4"><Empty text="暂无交易记录" /></div> : (
          <div className="divide-y divide-slate-50">
            {myTrades.map((t) => (
              <div key={t.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className={cx('w-7 h-7 rounded-lg grid place-items-center text-white', t.side === 'buy' ? 'bg-red-500' : 'bg-emerald-500')}>{t.side === 'buy' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}</span>
                <div className="flex-1">
                  <div className="font-medium text-[13px]">{t.side === 'buy' ? '买入' : '卖出'} {t.name}</div>
                  <div className="text-[11px] text-slate-400 num">{t.date} · {t.shares.toLocaleString()} 份 @ ¥{t.price.toFixed(3)}{t.fee ? ` · 费 ¥${t.fee}` : ''}</div>
                </div>
                <Tag tone={t.side === 'buy' ? 'red' : 'green'}>{t.side === 'buy' ? '买点' : '卖点'}</Tag>
              </div>
            ))}
          </div>
        )}
      </Card>

      {open && <TradeModal accountId={accId} accounts={secAccounts} onClose={() => setOpen(false)} onSave={(t) => { applyTrade(t); setOpen(false) }} />}
    </div>
  )
}

function TradeModal({ accountId, accounts, onClose, onSave }: { accountId: string; accounts: { id: string; name: string }[]; onClose: () => void; onSave: (t: NewTrade) => void }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [acc, setAcc] = useState(accountId)
  const price = quoteOf(findMeta('sh513100')).price
  const [shares, setShares] = useState('')
  const [px, setPx] = useState(String(price))
  const [fee, setFee] = useState('')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [note, setNote] = useState('')
  const sh = parseInt(shares) || 0
  const amt = sh * (parseFloat(px) || 0)

  return (
    <Modal open title={side === 'buy' ? '记录买入' : '记录卖出'} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={sh <= 0} onClick={() => onSave({ accountId: acc, symbol: 'sh513100', name: '纳指100ETF', side, date, price: parseFloat(px) || 0, shares: sh, fee: parseFloat(fee) || undefined, note: note || undefined })}>保存（{amt.toFixed(0)}元）</Button></>}>
      <div className="space-y-3">
        <Segmented options={[{ value: 'buy', label: '买入' }, { value: 'sell', label: '卖出' }]} value={side} onChange={(v) => setSide(v as 'buy' | 'sell')} />
        <Field label="证券账户"><Select value={acc} onChange={(e) => setAcc(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <div className="text-xs text-slate-400">标的：纳指100ETF（sh513100），当前价 ¥{price.toFixed(3)}</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="份额"><TextInput inputMode="numeric" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="如 10000" /></Field>
          <Field label="成交价"><TextInput inputMode="decimal" value={px} onChange={(e) => setPx(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="手续费"><TextInput inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" /></Field>
          <Field label="日期"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="备注"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：定投 / 波段补仓" /></Field>
      </div>
    </Modal>
  )
}






