import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { Card, PageHead, cx } from '../components/ui'
import { EChart, barOption, pieOption } from '../components/charts'
import { ChevronLeft, ChevronRight, Wallet, ArrowDownToLine, ArrowUpFromLine, Users, Car as CarIcon, Coins, CalendarDays } from 'lucide-react'

const fm = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => Math.round(n).toLocaleString('zh-CN')
const fmtW = (n: number) => (Math.abs(n) >= 1e4 ? (n / 1e4).toFixed(1) + '万' : fmt(n))

function yearStats(data: ReturnType<typeof useApp>['data'], year: number) {
  const prefix = String(year)
  const inc = Array(12).fill(0) as number[]
  const exp = Array(12).fill(0) as number[]
  const repay = Array(12).fill(0) as number[]
  const byCat = new Map<string, { name: string; color: string; value: number }>()
  for (const t of data.transactions) {
    if (!t.date.startsWith(prefix)) continue
    const m = parseInt(t.date.slice(5, 7), 10) - 1
    if (t.type === 'income') inc[m] += t.amount
    else if (t.type === 'expense') {
      exp[m] += t.amount
      const cat = data.categories.find((c) => c.id === t.categoryId)
      const key = cat?.name || '未分类'
      const cur = byCat.get(key) || { name: key, color: cat?.color || '#94a3b8', value: 0 }
      cur.value += t.amount
      byCat.set(key, cur)
    } else if (t.type === 'repay') repay[m] += t.amount
  }
  const cats = [...byCat.values()].sort((a, b) => b.value - a.value).slice(0, 6)
  const income = inc.reduce((a, b) => a + b, 0)
  const expense = exp.reduce((a, b) => a + b, 0)
  const repaySum = repay.reduce((a, b) => a + b, 0)
  const giftOut = data.gifts.filter((g) => g.date.startsWith(prefix) && g.direction === 'out')
  const giftIn = data.gifts.filter((g) => g.date.startsWith(prefix) && g.direction === 'in')
  const carTotal = data.fuelRecords.filter((r) => r.date.startsWith(prefix)).reduce((a, r) => a + r.amount, 0)
    + data.carExpenses.filter((e) => e.date.startsWith(prefix)).reduce((a, e) => a + e.amount, 0)
  const savingRate = income > 0 ? (income - expense) / income : 0
  return {
    months: Array.from({ length: 12 }, (_, i) => `${i + 1}月`), inc, exp, cats,
    income, expense, repaySum,
    giftOut: giftOut.reduce((a, g) => a + g.amount, 0), giftOutCount: giftOut.length,
    giftIn: giftIn.reduce((a, g) => a + g.amount, 0), giftInCount: giftIn.length,
    carTotal, savingRate,
  }
}

export default function Annual() {
  const { data } = useApp()
  const [year, setYear] = useState(dayjs().year())
  const years = useMemo(() => {
    const ys = new Set(data.transactions.map((t) => parseInt(t.date.slice(0, 4), 10)).filter((v) => !Number.isNaN(v)))
    if (data.gifts.length || data.fuelRecords.length || data.carExpenses.length) ys.add(dayjs().year())
    ys.add(dayjs().year())
    const list = [...ys].sort((a, b) => a - b)
    return { min: Math.min(...list), max: Math.max(...list) }
  }, [data])
  const cur = useMemo(() => yearStats(data, year), [data, year])
  const prev = useMemo(() => yearStats(data, year - 1), [data, year])
  const hasAny = cur.income + cur.expense + cur.giftOut + cur.giftIn + cur.carTotal > 0
  const expYoY = prev.expense > 0 ? ((cur.expense - prev.expense) / prev.expense) * 100 : undefined
  const balance = cur.income - cur.expense

  return (
    <div className="space-y-5">
      <PageHead
        title="年度总结"
        sub={`${year} 年 · 全年收支 · 人情往来 · 车辆开销`}
        right={
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button disabled={year <= years.min} onClick={() => setYear((y) => y - 1)} className="w-8 h-8 grid place-items-center rounded-lg bg-white shadow-sm text-slate-600 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="px-2 text-sm font-semibold num min-w-[64px] text-center">{year}</span>
            <button disabled={year >= years.max} onClick={() => setYear((y) => y + 1)} className="w-8 h-8 grid place-items-center rounded-lg bg-white shadow-sm text-slate-600 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        }
      />

      {!hasAny ? (
        <Card className="p-10 text-center">
          <CalendarDays size={28} className="mx-auto mb-2 text-slate-300" />
          <div className="text-sm text-slate-400">这一年还没有记录。记几笔后，这里会自动生成年度总结。</div>
          <Link to="/add" className="inline-block mt-4 text-sm text-blue-600 font-medium">去记一笔</Link>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<ArrowDownToLine size={16} />} tone="up" label="全年收入" value={fmtW(cur.income)} sub={`月均 ${fmtW(cur.income / 12)}`} />
            <Stat icon={<ArrowUpFromLine size={16} />} tone="down" label="全年支出" value={fmtW(cur.expense)} sub={expYoY === undefined ? '首年无对比' : `${expYoY >= 0 ? '+' : ''}${expYoY.toFixed(1)}% 同比`} />
            <Stat icon={<Wallet size={16} />} tone={balance >= 0 ? 'up' : 'down'} label="年度结余" value={fmtW(balance)} sub={`储蓄率 ${(cur.savingRate * 100).toFixed(0)}%`} />
            <Stat icon={<Users size={16} />} tone="flat" label="人情随礼" value={fmtW(cur.giftOut)} sub={`出 ${cur.giftOutCount} 笔 · 收 ${fmtW(cur.giftIn)}`} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-xs font-semibold tracking-[0.08em] text-slate-500 mb-2">月度收支</div>
              <EChart option={barOption(cur.months, [
                { name: '收入', data: cur.inc.map(fm), color: '#10b981' },
                { name: '支出', data: cur.exp.map(fm), color: '#f87171' },
              ])} height={240} />
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold tracking-[0.08em] text-slate-500 mb-2">支出分类占比</div>
              {cur.cats.length ? <EChart option={pieOption(cur.cats.map((c) => ({ name: c.name, value: fm(c.value), color: c.color })), { donut: true })} height={240} />
                : <div className="py-16 text-center text-slate-300 text-sm">本年暂无支出分类</div>}
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="还款（本金部分）" value={fmtW(cur.repaySum)} icon={<Coins size={15} />} />
            <MiniStat label="收礼金额" value={fmtW(cur.giftIn)} icon={<Users size={15} />} />
            <MiniStat label="车辆开销" value={fmtW(cur.carTotal)} icon={<CarIcon size={15} />} />
            <MiniStat label="去年总支出" value={fmtW(prev.expense)} icon={<Wallet size={15} />} />
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ icon, tone, label, value, sub }: { icon: React.ReactNode; tone: 'up' | 'down' | 'flat'; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">{icon}<span>{label}</span></div>
      <div className={cx('text-xl md:text-[24px] font-bold num mt-1.5', tone === 'up' ? 'text-emerald-600' : tone === 'down' ? 'text-red-500' : 'text-slate-800')}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </Card>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3.5 flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 grid place-items-center shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-400 truncate">{label}</div>
        <div className="text-sm font-bold num">{value}</div>
      </div>
    </Card>
  )
}
