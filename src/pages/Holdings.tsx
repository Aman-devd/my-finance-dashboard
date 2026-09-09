import { useMemo, useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { moneyShort } from '../lib/format'
import { useApp } from '../lib/store'
import { investmentView, investmentTotals } from '../lib/values'
import { findMeta, quoteOf, klineSeries, createMetaFromCode } from '../lib/market'
import { fetchQuoteByCode } from '../lib/quotes'
import { Button, Card, DateInput, Empty, Field, Modal, PageHead, Select, Segmented, Tag, TextInput, cx } from '../components/ui'
import { EChart, lineOption, barOption, pieOption } from '../components/charts'
import { Plus, TrendingUp, TrendingDown, Trash2, Search, Loader2, Pencil } from 'lucide-react'
import type { NewTrade } from '../lib/store'

export default function Holdings() {
  const { data, applyTrade, deleteTrade, deleteHolding } = useApp()
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
        <Card className="p-3.5 text-center border-slate-200/60">
          <div className="text-[11px] text-slate-400 mb-1">投入成本</div>
          <div className="num font-bold text-slate-900">¥{moneyShort(totals.cost)}</div>
        </Card>
        <Card className="p-3.5 text-center border-blue-200/50 bg-gradient-to-b from-blue-50/50 to-white">
          <div className="text-[11px] text-blue-500 mb-1">当前市值</div>
          <div className="num font-bold text-blue-600">¥{moneyShort(totals.mv)}</div>
        </Card>
        <Card className={cx('p-3.5 text-center', totals.pnl >= 0 ? 'border-red-200/50 bg-gradient-to-b from-red-50/50 to-white' : 'border-emerald-200/50 bg-gradient-to-b from-emerald-50/50 to-white')}>
          <div className={cx('text-[11px] mb-1', totals.pnl >= 0 ? 'text-red-400' : 'text-emerald-500')}>浮动盈亏</div>
          <div className={cx('num font-bold', totals.pnl >= 0 ? 'text-red-500' : 'text-emerald-600')}>{totals.pnl >= 0 ? '+' : ''}{moneyShort(totals.pnl)}</div>
        </Card>
      </div>

      {/* 两账户综合分析 */}
      {(() => {
        const ACC_COLORS = ['#0071e3', '#ff6b35', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
        const accStats = secAccounts.map((a, i) => {
          const hs = views.filter((v) => v.accountId === a.id)
          const cost = hs.reduce((s, v) => s + v.cost, 0)
          const mv = hs.reduce((s, v) => s + v.mv, 0)
          return { name: a.name, cost, mv, pnl: mv - cost, pnlPct: cost > 0 ? ((mv - cost) / cost) * 100 : 0, cash: a.balance, count: hs.length, color: ACC_COLORS[i % ACC_COLORS.length] }
        })
        const k90 = klineSeries(findMeta('sh513100'), 90)
        const comboDates = k90.map((x) => x.date)
        const comboValues = k90.map((kk) => views.reduce((s, v) => s + v.shares * kk.close, 0))
        const totalCost = accStats.reduce((s, a) => s + a.cost, 0)
        const totalMv = accStats.reduce((s, a) => s + a.mv, 0)
        return (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">账户综合分析</span>
              <span className="text-[10px] text-slate-400">{accStats.length} 个账户</span>
            </div>
            <div className="text-[11px] text-slate-400 mb-3">持仓成本 ¥{fm(totalCost)} · 市值 ¥{fm(totalMv)} · 盈亏 <span className={cx('font-medium', totalMv - totalCost >= 0 ? 'text-red-500' : 'text-emerald-600')}>¥{fm(totalMv - totalCost)}（{pct(totalCost ? ((totalMv - totalCost) / totalCost) * 100 : 0)}）</span></div>
            {accStats.length === 0 ? <div className="text-xs text-slate-300 py-3">暂无持仓数据</div> : (
              <>
                <div className="grid sm:grid-cols-2 gap-3 mb-3">
                  {accStats.map((a) => (
                    <div key={a.name} className="rounded-xl p-3 border border-slate-200/60" style={{ background: `linear-gradient(135deg, ${a.color}08 0%, ${a.color}03 100%)` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }}></span>
                        <span className="text-xs font-medium text-slate-700 truncate">{a.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{a.count} 只</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="num font-bold text-lg text-slate-900">{fm(a.mv)}</span>
                        <span className={cx('num text-xs font-semibold', a.pnl >= 0 ? 'text-red-500' : 'text-emerald-600')}>{a.pnl >= 0 ? '+' : ''}{fm(a.pnl)}（{pct(a.pnlPct)}）</span>
                      </div>
                      <div className="text-[10px] text-slate-400 num mt-1">成本 ¥{fm(a.cost)} · 可用 ¥{fm(a.cash)}</div>
                    </div>
                  ))}
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">成本 vs 市值（按账户）</div>
                    <EChart option={barOption(accStats.map((a) => a.name), [
                      { name: '成本', data: accStats.map((a) => Math.round(a.cost)), color: '#94a3b8' },
                      { name: '市值', data: accStats.map((a) => Math.round(a.mv)), color: '#0071e3' },
                    ])} height={200} />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">市值占比</div>
                    <EChart option={pieOption(accStats.map((a) => ({ name: a.name, value: Math.round(a.mv), color: a.color })), { donut: true })} height={200} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-[11px] text-slate-400 mb-1">合并市值走势（近 90 日，按当前持仓估算）</div>
                  <EChart option={lineOption(comboDates, [{ name: '合并市值', data: comboValues.map((v) => Math.round(v)), color: '#0071e3', area: true }], { yFmt: (v) => (v / 10000).toFixed(1) + '万' })} height={200} />
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
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">当前持仓</span>
          <span className="text-[10px] text-slate-400">{myHoldings.length} 只</span>
        </div>
        {myHoldings.length === 0 && <div className="px-4 pb-4"><Empty text="该账户暂无持仓，记录一笔买入吧" /></div>}
        <div className="divide-y divide-slate-100">
          {myHoldings.map((h) => (
            <div key={h.id} className="px-4 py-3 flex items-center gap-3 group hover:bg-slate-50/50 transition-colors">
              <span className={cx('w-10 h-10 rounded-xl grid place-items-center text-xs font-bold shrink-0', h.pnl >= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}>{h.name.slice(0, 2)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900">{h.name} <span className="text-[10px] text-slate-400 font-normal">{h.symbol}</span></div>
                <div className="text-[11px] text-slate-400 num mt-0.5">{h.shares.toLocaleString()} 份 · 成本 ¥{h.avgCost.toFixed(3)} · 现价 ¥{h.price.toFixed(3)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold num text-slate-900">¥{fm(h.mv)}</div>
                <div className={cx('text-xs num font-medium mt-0.5', h.pnl >= 0 ? 'text-red-500' : 'text-emerald-600')}>{h.pnl >= 0 ? '+' : ''}{fm(h.pnl)}（{pct(h.pnlPct)}）</div>
              </div>
              <button
                onClick={() => { if (confirm(`确定删除「${h.name}」的全部持仓和交易记录吗？此操作不可撤销。`)) { deleteHolding(h.accountId, h.symbol) } }}
                className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                title="删除持仓"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">买卖点记录</span>
          <span className="text-[10px] text-slate-400">近 {myTrades.length} 笔</span>
        </div>
        {myTrades.length === 0 ? <div className="px-4 pb-4"><Empty text="暂无交易记录" /></div> : (
          <div className="divide-y divide-slate-100">
            {myTrades.map((t) => (
              <div key={t.id} className="px-4 py-2.5 flex items-center gap-3 text-sm group hover:bg-slate-50/50 transition-colors">
                <span className={cx('w-8 h-8 rounded-lg grid place-items-center text-white shrink-0', t.side === 'buy' ? 'bg-gradient-to-br from-red-400 to-red-500' : 'bg-gradient-to-br from-emerald-400 to-emerald-500')}>{t.side === 'buy' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[13px] text-slate-900">{t.side === 'buy' ? '买入' : '卖出'} {t.name}</div>
                  <div className="text-[11px] text-slate-400 num mt-0.5">{t.date} · {t.shares.toLocaleString()} 份 @ ¥{t.price.toFixed(3)}{t.fee ? ` · 费 ¥${t.fee}` : ''}</div>
                </div>
                <Tag tone={t.side === 'buy' ? 'red' : 'green'}>{t.side === 'buy' ? '买点' : '卖点'}</Tag>
                <button
                  onClick={() => { if (confirm('确定删除这笔交易记录吗？持仓和账户余额会自动回滚。')) { deleteTrade(t.id) } }}
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg grid place-items-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                  title="删除交易"
                >
                  <Trash2 size={13} />
                </button>
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
  // 预设热门标的
  const HOT_SYMBOLS = [
    { symbol: 'sh513100', name: '纳指100ETF' },
    { symbol: 'sh510300', name: '沪深300ETF' },
    { symbol: 'sh510500', name: '中证500ETF' },
    { symbol: 'sz159915', name: '创业板ETF' },
    { symbol: 'sh588000', name: '科创50ETF' },
    { symbol: 'sh600519', name: '贵州茅台' },
  ]
  const [codeInput, setCodeInput] = useState('sh513100')
  const [searching, setSearching] = useState(false)
  const [foundName, setFoundName] = useState('纳指100ETF')
  const [foundPrice, setFoundPrice] = useState(0)
  const [searchError, setSearchError] = useState('')
  const [shares, setShares] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [fee, setFee] = useState('')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [note, setNote] = useState('')

  const sh = parseInt(shares) || 0
  const cost = parseFloat(costPrice) || 0
  const currentPrice = foundPrice
  const profit = side === 'buy' && sh > 0 && cost > 0 && currentPrice > 0 ? (currentPrice - cost) * sh : 0
  const profitPct = side === 'buy' && cost > 0 ? ((currentPrice - cost) / cost) * 100 : 0
  const totalCost = sh * cost
  const canSave = sh > 0 && codeInput.trim() && foundName.trim() && cost > 0

  // 输入代码后自动查询行情（防抖）
  useEffect(() => {
    const code = codeInput.trim().toLowerCase()
    if (!code) { setFoundName(''); setFoundPrice(0); setSearchError(''); return }
    // 先检查预设标的
    const hot = HOT_SYMBOLS.find((s) => s.symbol === code)
    if (hot) {
      setFoundName(hot.name)
      // 尝试从缓存获取价格
      const meta = findMeta(code)
      if (meta) {
        const q = quoteOf(meta)
        if (q.price > 0) { setFoundPrice(q.price); setSearchError(''); return }
      }
    }
    // 自动查询
    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      const result = await fetchQuoteByCode(code)
      setSearching(false)
      if (result) {
        setFoundName(result.name)
        setFoundPrice(result.quote.price)
      } else {
        setFoundName('')
        setFoundPrice(0)
        setSearchError('未找到该标的行情，请检查代码格式（如 sh513100、sz000001）')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [codeInput])

  return (
    <Modal open title={side === 'buy' ? '记录买入' : '记录卖出'} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!canSave} onClick={() => onSave({ accountId: acc, symbol: codeInput.trim().toLowerCase(), name: foundName, side, date, price: cost, shares: sh, fee: parseFloat(fee) || undefined, note: note || undefined })}>保存（成本 ¥{totalCost.toFixed(0)}）</Button></>}>
      <div className="space-y-3">
        <Segmented options={[{ value: 'buy', label: '买入' }, { value: 'sell', label: '卖出' }]} value={side} onChange={(v) => setSide(v as 'buy' | 'sell')} />
        <Field label="证券账户"><Select value={acc} onChange={(e) => setAcc(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>

        {/* 股票代码输入 + 自动查询 */}
        <Field label="股票/基金代码">
          <div className="relative">
            <TextInput
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="输入代码自动查行情，如 sh513100"
              className="!pr-10"
            />
            {searching ? (
              <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
            ) : (
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            )}
          </div>
        </Field>

        {/* 热门标的快捷选择 */}
        <div className="flex flex-wrap gap-1.5">
          {HOT_SYMBOLS.map((s) => (
            <button
              key={s.symbol}
              onClick={() => setCodeInput(s.symbol)}
              className={cx('px-2 py-1 rounded-lg text-[11px] border transition-all', codeInput === s.symbol ? 'border-[#0071e3] bg-[#0071e3]/8 text-[#0071e3] font-medium' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50')}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* 查询结果显示 */}
        {foundName && foundPrice > 0 && (
          <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{foundName}</div>
                <div className="text-[10px] text-slate-400">{codeInput}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900 tabular-nums">¥{foundPrice.toFixed(3)}</div>
                <div className="text-[10px] text-emerald-600">实时行情</div>
              </div>
            </div>
          </div>
        )}
        {searchError && <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{searchError}</div>}

        {/* 成本价和份额 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={side === 'buy' ? '买入成本价' : '卖出价'}><TextInput inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="如 2.150" /></Field>
          <Field label="份额"><TextInput inputMode="numeric" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="如 10000" /></Field>
        </div>

        {/* 盈亏预览 */}
        {side === 'buy' && sh > 0 && cost > 0 && currentPrice > 0 && (
          <div className={cx('rounded-xl p-3 border', profit >= 0 ? 'bg-red-50/80 border-red-200/60' : 'bg-emerald-50/80 border-emerald-200/60')}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">持仓盈亏（预估）</span>
              <span className={cx('text-lg font-bold tabular-nums', profit >= 0 ? 'text-red-600' : 'text-emerald-600')}>
                {profit >= 0 ? '+' : ''}{profit.toFixed(2)}元
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-slate-400">盈亏比例</div><div className={cx('font-medium tabular-nums mt-0.5', profit >= 0 ? 'text-red-600' : 'text-emerald-600')}>{profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%</div></div>
              <div><div className="text-slate-400">持仓成本</div><div className="text-slate-700 font-medium tabular-nums mt-0.5">¥{totalCost.toFixed(0)}</div></div>
              <div><div className="text-slate-400">当前市值</div><div className="text-slate-700 font-medium tabular-nums mt-0.5">¥{(sh * currentPrice).toFixed(0)}</div></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="手续费（可选）"><TextInput inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" /></Field>
          <Field label="日期"><DateInput value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="备注（可选）"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：定投 / 波段补仓" /></Field>
      </div>
    </Modal>
  )
}






