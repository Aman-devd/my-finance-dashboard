import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { netWorth, totalAssets, totalDebt, investmentTotals, accountAssetValue } from '../lib/values'
import { liquidTotal } from '../lib/calc'
import CalendarBoard from './Calendar'
import { upcomingReminders } from '../lib/reminders'
import { INDICES, quoteOf, ETF, marketOpen } from '../lib/market'
import { Card, SectionTitle, Tag, Progress, cx, Modal } from '../components/ui'
import { EChart, barOption, pieOption } from '../components/charts'
import { useLiveQuotes } from '../lib/quotes'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Users, Car, Bell, Plus, CalendarDays, Activity } from 'lucide-react'

export default function Dashboard() {
  const { data } = useApp()
  const [calOpen, setCalOpen] = useState(false)
  const now = dayjs()
  const liveTick = useLiveQuotes()
  const mKey = now.format('YYYY-MM')

  const s = useMemo(() => {
    const monthTxs = data.transactions.filter((t) => t.date.startsWith(mKey))
    const income = monthTxs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
    const repay = monthTxs.filter((t) => t.type === 'repay').reduce((a, t) => a + t.amount, 0)
    const carExp = data.carExpenses.filter((e) => e.date.startsWith(mKey)).reduce((a, e) => a + e.amount, 0)

    // 近6个月收支
    const months: string[] = []
    const incArr: number[] = []
    const expArr: number[] = []
    for (let i = 5; i >= 0; i--) {
      const mk = now.subtract(i, 'month').format('YYYY-MM')
      const txs = data.transactions.filter((t) => t.date.startsWith(mk))
      months.push(now.subtract(i, 'month').format('M月'))
      incArr.push(Math.round(txs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)))
      expArr.push(Math.round(txs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)))
    }

    // 本月支出分类
    const byCat = new Map<string, { name: string; color: string; value: number }>()
    for (const t of monthTxs) {
      if (t.type !== 'expense') continue
      const cat = data.categories.find((c) => c.id === t.categoryId)
      const key = cat?.name || '未分类'
      const cur = byCat.get(key) || { name: key, color: cat?.color || '#94a3b8', value: 0 }
      cur.value += t.amount
      byCat.set(key, cur)
    }
    const sorted = [...byCat.values()].sort((a, b) => b.value - a.value)
    const top = sorted.slice(0, 6)
    const rest = sorted.slice(6).reduce((a, c) => a + c.value, 0)
    const pie = [...top, ...(rest > 0 ? [{ name: '其他', color: '#cbd5e1', value: rest }] : [])].map((i) => ({ name: i.name, value: Math.round(i.value), color: i.color }))

    // 本月待还
    const dueLoans = data.accounts.filter((a) => a.category === 'loan' && a.loan)
      .filter((a) => { const dd = Math.min(a.loan!.dueDay, 28); const due = dayjs(`${now.year()}-${now.month() + 1}-${String(dd).padStart(2, '0')}`); return due.isAfter(now.subtract(1, 'day')) && due.month() === now.month() })
    const dueTotal = dueLoans.reduce((a, x) => a + (x.loan?.monthlyPayment || 0), 0)

    // 资产构成
    const liquid = liquidTotal(data)
    const securities = data.accounts.filter((a) => a.category === 'securities').reduce((a, x) => a + accountAssetValue(x, data), 0)
    const fund = data.accounts.filter((a) => a.category === 'fund').reduce((a, x) => a + x.balance, 0)
    const other = data.accounts.filter((a) => ['cash', 'bank', 'alipay', 'wechat'].includes(a.category) === false && a.category !== 'securities' && a.category !== 'fund' && a.category !== 'loan').reduce((a, x) => a + x.balance, 0)
    const alloc = [
      { name: '现金及银行', value: Math.round(liquid + other), color: '#0ea5e9' },
      { name: '证券持仓', value: Math.round(securities), color: '#8b5cf6' },
      { name: '公积金', value: Math.round(fund), color: '#f59e0b' },
    ].filter((i) => i.value > 0)

    const recent = [...data.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
    const reminders = upcomingReminders(data, 30).slice(0, 4)
    const inv = investmentTotals(data)
    const quotes = INDICES.map((m) => quoteOf(m))
    const etfQ = quoteOf(ETF)
    return { income, expense, repay, carExp, months, incArr, expArr, pie, dueTotal, alloc, recent, reminders, inv, quotes, etfQ }
  }, [data, mKey, liveTick])

  const nw = netWorth(data)
  const assets = totalAssets(data)
  const debt = totalDebt(data)

  const catName = (id?: string) => data.categories.find((c) => c.id === id)?.name || '未分类'
  const catColor = (id?: string) => data.categories.find((c) => c.id === id)?.color || '#94a3b8'
  const accName = (id?: string) => data.accounts.find((a) => a.id === id)?.name || '已删除账户'

  const fm = (n: number) => (Math.round(n * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
  const fmShort = (n: number) => {
    const abs = Math.abs(n)
    if (abs >= 1e8) return (n / 1e8).toFixed(2) + '亿'
    if (abs >= 1e4) return (n / 1e4).toFixed(1) + '万'
    return n.toFixed(0)
  }

  return (
    <div className="space-y-5">
      {/* 净资产 Hero */}
      <Card className="relative text-white border-0 overflow-hidden" style={{ background: 'linear-gradient(145deg, #0a1628 0%, #122547 40%, #1a3360 70%, #1e3d72 100%)', boxShadow: '0 20px 50px -25px rgba(10,22,40,0.6), 0 8px 20px -12px rgba(10,22,40,0.4)' }}>
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-20 w-96 h-96 rounded-full opacity-25" style={{ background: 'radial-gradient(circle at 40% 40%, rgba(96,165,250,0.9), transparent 65%)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full opacity-15" style={{ background: 'radial-gradient(circle at 60% 60%, rgba(59,130,246,0.8), transparent 60%)' }} />
        <div aria-hidden className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative p-6 md:p-9">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-[13px] font-medium text-slate-400 tracking-wide">净资产（总资产 − 总负债）</div>
          </div>
          <div className="text-[clamp(38px,12vw,56px)] md:text-[64px] font-bold tracking-tight num mt-2 text-white leading-none" data-fit-min="28">¥{fm(nw)}</div>
          <div className="flex flex-wrap gap-x-7 gap-y-2 mt-4 text-[14px] text-slate-300 num">
            <span>总资产 <b className="text-emerald-600">¥{fmShort(assets)}</b></span>
            <span>总负债 <b className="text-red-500">¥{fmShort(debt)}</b></span>
            <span>本月支出 <b className="text-red-500">¥{fmShort(s.expense)}</b></span>
            <span>本月收入 <b className="text-emerald-600">¥{fmShort(s.income)}</b></span>
          </div>

        </div>
      </Card>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="本月收入" value={fmShort(s.income)} sub="含还款转入" tone="up" />
        <MiniStat label="本月支出" value={fmShort(s.expense)} sub="不含贷款还款" tone="down" />
        <MiniStat label="投资盈亏" value={fmShort(s.inv.pnl)} sub={`${s.inv.pnlPct >= 0 ? '+' : ''}${s.inv.pnlPct.toFixed(2)}%`} tone={s.inv.pnl >= 0 ? 'gain' : 'loss'} />
        <MiniStat label="本月待还" value={fmShort(s.dueTotal)} sub="车贷+助学贷" tone="down" />
      </div>

      {/* 指数速览 */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>行情速览 <span className="ml-1 text-[10px] font-normal text-slate-400">{marketOpen(ETF) ? '· A股交易中' : '· 已收盘'}</span></SectionTitle>
          <Link to="/markets" className="text-xs text-blue-600">详情</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {s.quotes.map((q) => <MiniQuote key={q.symbol} name={q.name} price={q.price} pct={q.changePct} />)}
          <MiniQuote name={ETF.name.replace('纳指100ETF', 'ETF')} price={s.etfQ.price} pct={s.etfQ.changePct} sub="CNY" />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionTitle>近 6 个月收支</SectionTitle>
          <EChart option={barOption(s.months, [
            { name: '收入', data: s.incArr, color: '#10b981' },
            { name: '支出', data: s.expArr, color: '#f87171' },
          ])} height={260} />
        </Card>
        <Card className="p-4">
          <SectionTitle>本月支出构成</SectionTitle>
          {s.pie.length ? <EChart option={pieOption(s.pie, { donut: true })} height={260} /> : <div className="py-16 text-center text-slate-300 text-sm">本月暂无支出</div>}
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 md:col-span-2">
          <SectionTitle right={<Link to="/transactions" className="text-xs text-blue-600">全部</Link>}>最近账单</SectionTitle>
          <div className="divide-y divide-slate-50">
            {s.recent.length === 0 && <div className="py-8 text-center text-slate-300 text-sm">还没有账单，点右下角「记一笔」开始</div>}
            {s.recent.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="w-9 h-9 rounded-full grid place-items-center text-white shrink-0" style={{ background: catColor(t.categoryId) }}>
                  {t.type === 'income' ? <ArrowDownRight size={16} /> : t.type === 'expense' || t.type === 'repay' ? <ArrowUpRight size={16} /> : <TrendingUp size={15} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.note || catName(t.categoryId)}{t.type === 'transfer' && ` → ${accName(t.toAccountId)}`}</div>
                  <div className="text-[11px] text-slate-400">{dayjs(t.date).format('M月D日')} · {accName(t.accountId)}</div>
                </div>
                <div className={cx('text-sm num font-semibold', t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' || t.type === 'repay' ? 'text-slate-800' : 'text-slate-500')}>
                  {t.type === 'income' ? '+' : '-'}{fm(t.amount)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-4">
            <SectionTitle right={<Link to="/reminders" className="text-xs text-blue-600">全部</Link>}>提醒</SectionTitle>
            {s.reminders.length === 0 && <div className="text-xs text-slate-400 py-3">近 30 天暂无提醒</div>}
            <div className="space-y-2.5">
              {s.reminders.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <Bell size={14} className="text-amber-500 shrink-0" />
                  <span className="flex-1 truncate">{r.title}</span>
                  <Tag tone={r.daysLeft === 0 ? 'red' : r.daysLeft <= 3 ? 'amber' : 'blue'}>{r.daysLeft === 0 ? '今天' : `${r.daysLeft}天后`}</Tag>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <SectionTitle>资产构成</SectionTitle>
            {s.alloc.length ? <EChart option={pieOption(s.alloc, { donut: true })} height={200} /> : null}
          </Card>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <QuickBtn onClick={() => setCalOpen(true)} icon={<CalendarDays size={20} />} label="日历" />
        <QuickLink to="/gains" icon={<Activity size={20} />} label="收益分析" />
        <QuickLink to="/people" icon={<Users size={20} />} label="人情往来" />
        <QuickLink to="/cars" icon={<Car size={20} />} label="车辆管理" />
        <QuickLink to="/tools" icon={<TrendingUp size={20} />} label="工具箱" />
        <QuickLink to="/more" icon={<Bell size={20} />} label="我的" />
      </div>

      {calOpen && (
        <Modal open title="日历 · 生日与提醒" onClose={() => setCalOpen(false)}>
          <div className="max-h-[72vh] overflow-y-auto -mx-1 px-1">
            <CalendarBoard />
          </div>
        </Modal>
      )}
    </div>
  )
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'up' | 'down' | 'gain' | 'loss' | 'flat' }) {
  return (
    <Card className="p-4">
      <div className="label">{label}</div>
      <div className={cx('num-lg mt-1.5', tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : tone === 'up' ? 'text-loss' : tone === 'down' ? 'text-gain' : 'text-slate-800')}>{value}</div>
      {sub && <div className="num-xs mt-1 truncate">{sub}</div>}
    </Card>
  )
}

function MiniQuote({ name, price, pct, sub }: { name: string; price: number; pct: number; sub?: string }) {
  const up = pct >= 0
  return (
    <div className="rounded-2xl bg-white/50 backdrop-blur-md border border-white/60 p-3 shadow-sm">
      <div className="label truncate">{name}{sub && <span className="text-muted"> {sub}</span>}</div>
      <div className="num-md mt-1">{price.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
      <div className={cx('num-xs flex items-center gap-0.5 mt-0.5', up ? 'text-gain' : 'text-loss')}>
        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
      </div>
    </div>
  )
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="bg-white/40 backdrop-blur-md rounded-xl border border-white/50 p-4 flex flex-col items-center gap-2 text-slate-600 transition hover:border-white/70 hover:bg-white/50 shadow-sm">
      <span className="text-blue-600">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  )
}

function QuickBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="bg-white/40 backdrop-blur-md rounded-xl border border-white/50 p-4 flex flex-col items-center gap-2 text-slate-600 transition hover:border-white/70 hover:bg-white/50 shadow-sm">
      <span className="text-blue-600">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
















