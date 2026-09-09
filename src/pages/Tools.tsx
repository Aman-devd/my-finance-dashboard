import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { futureValueLump, futureValueDCA, requiredMonthly, earlyPayoffSaving, monthlyPayment, financialHealth, cashflowForecast, liquidTotal } from '../lib/calc'
import { Button, Card, Field, Modal, PageHead, Progress, Segmented, Tag, TextInput, cx } from '../components/ui'
import { EChart, lineOption, barOption } from '../components/charts'
import { Plus, Trash2, Pencil } from 'lucide-react'
import type { Goal } from '../types'

type Tab = 'compound' | 'loan' | 'goal' | 'health' | 'sub'

export default function Tools() {
  const [tab, setTab] = useState<Tab>('compound')
  return (
    <div>
      <PageHead title="工具箱" sub="复利计算 · 提前还款 · 目标储蓄 · 财务体检" />
      <div className="mb-4 overflow-x-auto"><Segmented options={[{ value: 'compound', label: '复利计算' }, { value: 'loan', label: '提前还款' }, { value: 'goal', label: '目标储蓄' }, { value: 'health', label: '财务体检' }, { value: 'sub', label: '订阅汇总' }]} value={tab} onChange={(v) => setTab(v as Tab)} /></div>
      {tab === 'compound' && <Compound />}
      {tab === 'loan' && <LoanEarly />}
      {tab === 'goal' && <Goals />}
      {tab === 'health' && <Health />}
      {tab === 'sub' && <Subs />}
    </div>
  )
}

function Compound() {
  const [lump, setLump] = useState('100000')
  const [rate, setRate] = useState('6')
  const [years, setYears] = useState('10')
  const [monthly, setMonthly] = useState('3000')
  const [target, setTarget] = useState('1000000')
  const [tYears, setTYears] = useState('15')
  const P = parseFloat(lump) || 0, R = parseFloat(rate) || 0, Y = parseFloat(years) || 0, M = parseFloat(monthly) || 0
  const lumpEnd = futureValueLump(P, R, Y)
  const dcaEnd = futureValueDCA(M, R, Y)
  const total = lumpEnd + dcaEnd
  const needM = requiredMonthly(parseFloat(target) || 0, R, parseFloat(tYears) || 1)
  const yearsArr = Array.from({ length: Math.max(1, Math.ceil(Y)) }, (_, i) => i + 1)
  const curve = yearsArr.map((y) => futureValueLump(P, R, y) + futureValueDCA(M, R, y))
  const invested = yearsArr.map((y) => P + M * 12 * y) // 累计投入本金
  const chart = lineOption(yearsArr.map((y) => `${y}年`), [{ name: '账户价值(本金+盈利)', data: curve.map((v) => Math.round(v)), color: '#2563eb', area: true },
    { name: '累计投入本金', data: invested.map((v) => Math.round(v)), color: '#94a3b8', dashed: true }], { yFmt: (v) => (v / 10000).toFixed(1) + '万' })
  const fm = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="现有本金（元）"><TextInput inputMode="decimal" value={lump} onChange={(e) => setLump(e.target.value)} /></Field>
          <Field label="预期年化 %"><TextInput inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="年限（年）"><TextInput inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} /></Field>
          <Field label="每月定投（元）"><TextInput inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></Field>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">本金终值</span><b className="num">¥{fm(lumpEnd)}</b></div>
          <div className="flex justify-between mt-1"><span className="text-slate-500">定投终值</span><b className="num">¥{fm(dcaEnd)}</b></div>
          <div className="flex justify-between mt-2 border-t border-blue-100 pt-2"><span className="font-semibold">{Y} 年后合计</span><b className="num text-blue-700 text-lg">¥{fm(total)}</b></div>
          <div className="text-[11px] text-slate-400 mt-1">其中投入本金 ¥{fm(P + M * Y * 12)}，增值 ¥{fm(Math.max(0, total - P - M * Y * 12))}</div>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold text-slate-500 mb-2">目标反推：想攒到 X，每月要投多少</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="目标金额"><TextInput inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
            <Field label="目标年限"><TextInput inputMode="decimal" value={tYears} onChange={(e) => setTYears(e.target.value)} /></Field>
          </div>
          <div className="mt-2 text-sm">按年化 {R}% 计算，需每月定投 <b className="text-blue-700 num">¥{fm(needM)}</b></div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">增长曲线</div>
        <EChart option={chart} height={300} />
      </Card>
    </div>
  )
}

function LoanEarly() {
  const { data } = useApp()
  const loans = data.accounts.filter((a) => a.category === 'loan')
  const [loanId, setLoanId] = useState(loans[0]?.id || '')
  const loan = loans.find((l) => l.id === loanId)
  const [principal, setPrincipal] = useState(loan ? String(loan.balance) : '')
  const [rate, setRate] = useState(loan?.loan?.ratePct ? String(loan.loan.ratePct) : '4')
  const [months, setMonths] = useState('60')
  const [prepay, setPrepay] = useState('10000')
  const P = parseFloat(principal) || 0, R = parseFloat(rate) || 0, Mo = parseInt(months) || 1, Pre = Math.min(parseFloat(prepay) || 0, P)
  const pay = monthlyPayment(P, R, Mo)
  const res = earlyPayoffSaving(P, R, Mo, Pre)
  return (
    <Card className="p-4 space-y-3 max-w-xl">
      <Field label="选择负债（可手动修改下面参数）">
        <select className="w-full rounded-xl border border-slate-200 px-3 py-2.5" value={loanId} onChange={(e) => { setLoanId(e.target.value); const l = loans.find((x) => x.id === e.target.value); if (l) { setPrincipal(String(l.balance)); if (l.loan?.ratePct) setRate(String(l.loan.ratePct)) } }}>
          {loans.length === 0 && <option value="">暂无负债账户</option>}
          {loans.map((l) => <option key={l.id} value={l.id}>{l.name}（欠 ¥{l.balance.toFixed(0)}）</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="剩余本金"><TextInput inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></Field>
        <Field label="年利率 %"><TextInput inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        <Field label="剩余期数"><TextInput inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} /></Field>
      </div>
      <Field label="打算提前还多少"><TextInput inputMode="decimal" value={prepay} onChange={(e) => setPrepay(e.target.value)} /></Field>
      <div className="rounded-xl bg-emerald-50 p-4 text-sm">
        <div className="flex justify-between"><span className="text-slate-600">当前月供（等额本息）</span><b className="num">¥{pay.toFixed(0)}</b></div>
        <div className="flex justify-between mt-1.5"><span className="text-slate-600">原计划总利息</span><b className="num">¥{res.oldInterest.toFixed(0)}</b></div>
        <div className="flex justify-between mt-1.5"><span className="text-slate-600">提前还 ¥{Pre.toFixed(0)} 后总利息</span><b className="num">¥{res.newInterest.toFixed(0)}</b></div>
        <div className="flex justify-between mt-2 border-t border-emerald-100 pt-2"><span className="font-semibold text-emerald-700">可省利息</span><b className="num text-emerald-700 text-lg">¥{res.savedInterest.toFixed(0)}</b></div>
        <div className="text-[11px] text-slate-400 mt-1">月供不变、期数从 {Mo} 期缩短到 {res.newRemainingMonths} 期</div>
      </div>
    </Card>
  )
}

function Goals() {
  const { data, addGoal, updateGoal, deleteGoal } = useApp()
  const [form, setForm] = useState<{ open: boolean; goal?: Goal }>({ open: false })
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">为目标每月存一点，进度一目了然</p>
        <Button onClick={() => setForm({ open: true })}><Plus size={15} /> 新建目标</Button>
      </div>
      {data.goals.length === 0 && <Card className="p-8 text-center text-slate-300 text-sm">还没有目标，比如"日本旅行 ¥3万"</Card>}
      <div className="grid sm:grid-cols-2 gap-3">
        {data.goals.map((g) => {
          const pct = (g.savedAmount / g.targetAmount) * 100
          const leftMonths = g.deadline ? Math.max(1, dayjs(g.deadline).diff(dayjs(), 'month', true)) : 12
          const needMonthly = Math.max(0, (g.targetAmount - g.savedAmount) / leftMonths)
          return (
            <Card key={g.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color || '#2563eb' }} />
                <span className="font-semibold flex-1">{g.name}</span>
                <button onClick={() => setForm({ open: true, goal: g })} className="text-slate-400"><Pencil size={14} /></button>
                <button onClick={() => deleteGoal(g.id)} className="text-red-400"><Trash2 size={14} /></button>
              </div>
              <div className="flex items-end justify-between">
                <div><span className="text-xl font-bold num">¥{g.savedAmount.toLocaleString()}</span><span className="text-slate-400 text-sm"> / ¥{g.targetAmount.toLocaleString()}</span></div>
                <Tag tone={pct >= 100 ? 'green' : 'blue'}>{pct.toFixed(0)}%</Tag>
              </div>
              <Progress value={pct} color={g.color} />
              <div className="text-[11px] text-slate-400">{g.deadline ? `距 ${g.deadline} 还需每月存 ¥${Math.ceil(needMonthly).toLocaleString()}` : `已存 ¥${g.savedAmount.toLocaleString()}`}{g.monthly ? ` · 计划每月 ¥${g.monthly}` : ''}</div>
            </Card>
          )
        })}
      </div>
      {form.open && <GoalForm goal={form.goal} onClose={() => setForm({ open: false })} onSave={(g) => { if (form.goal) updateGoal(form.goal.id, g); else addGoal(g); setForm({ open: false }) }} />}
    </div>
  )
}

function GoalForm({ goal, onClose, onSave }: { goal?: Goal; onClose: () => void; onSave: (g: Omit<Goal, 'id'>) => void }) {
  const [name, setName] = useState(goal?.name || '')
  const [target, setTarget] = useState(goal ? String(goal.targetAmount) : '')
  const [saved, setSaved] = useState(goal ? String(goal.savedAmount) : '')
  const [monthly, setMonthly] = useState(goal?.monthly ? String(goal.monthly) : '')
  const [deadline, setDeadline] = useState(goal?.deadline || '')
  const [color, setColor] = useState(goal?.color || '#2563eb')
  const ok = name.trim() && (parseFloat(target) || 0) > 0
  return (
    <Modal open title={goal ? '编辑目标' : '新建目标'} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!ok} onClick={() => onSave({ name: name.trim(), targetAmount: parseFloat(target) || 0, savedAmount: parseFloat(saved) || 0, monthly: monthly ? parseFloat(monthly) : undefined, deadline: deadline || undefined, color })}>保存</Button></>}>
      <div className="space-y-3">
        <Field label="目标名称"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="如：日本旅行" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="目标金额"><TextInput inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          <Field label="已存金额"><TextInput inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="计划每月存"><TextInput inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></Field>
          <Field label="目标日期"><TextInput type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        </div>
        <Field label="颜色">
          <div className="flex gap-2">{(['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']).map((c) => <button key={c} onClick={() => setColor(c)} className={cx('w-7 h-7 rounded-full', color === c && 'ring-2 ring-offset-2 ring-slate-400')} style={{ background: c }} />)}</div>
        </Field>
      </div>
    </Modal>
  )
}

function Health() {
  const { data } = useApp()
  const h = financialHealth(data)
  const fc = cashflowForecast(data, 6)
  const scoreColor = h.score >= 80 ? '#10b981' : h.score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.6" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={scoreColor} strokeWidth="3.6" strokeDasharray={`${h.score} 100`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 grid place-items-center font-bold text-xl num" style={{ color: scoreColor }}>{h.score}</div>
          </div>
          <div>
            <div className="font-bold">财务健康度</div>
            <div className="text-xs text-slate-400 mt-1">基于应急金与负债比估算，仅供参考</div>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1.5">
          <Row label="应急金（流动资产/月均支出）" value={`${h.emergencyMonths === 99 ? '充足' : h.emergencyMonths + ' 个月'}`} />
          <Row label="流动资产合计" value={`¥${h.liquidTotal.toLocaleString()}`} />
          <Row label="近3月平均月支出" value={`¥${h.avgMonthlyExpense.toLocaleString()}`} />
          <Row label="总负债" value={`¥${h.totalDebt.toLocaleString()}`} />
          <Row label="负债占收入比" value={`${h.debtToIncomePct}%`} />
        </div>
        <div>
          {h.tips.map((tip, i) => <div key={i} className="text-xs text-slate-600 bg-amber-50 rounded-lg px-3 py-2 mb-1.5">💡 {tip}</div>)}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-sm font-semibold mb-1">未来 6 个月现金流预测</div>
        <div className="text-[11px] text-slate-400 mb-2">按近 3 个月平均净结余线性外推（未含大额计划支出）</div>
        <EChart option={barOption(fc.map((f) => f.month.slice(5) + '月'), [{ name: '预计余额', data: fc.map((f) => f.balance), color: '#0ea5e9' }])} height={230} />
        <div className="grid grid-cols-3 gap-2 text-center mt-1">
          {fc.slice(0, 3).map((f) => <div key={f.month} className="rounded-xl bg-slate-50 p-2"><div className="text-[10px] text-slate-400">{f.month}</div><div className={cx('num text-sm font-bold', f.balance < 0 ? 'text-red-500' : 'text-slate-800')}>¥{f.balance.toLocaleString()}</div></div>)}
        </div>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><b className="num">{value}</b></div>
}

function Subs() {
  const { data } = useApp()
  const subs = useMemo(() => {
    const byNote = new Map<string, { months: Set<string>; total: number; count: number }>()
    for (const t of data.transactions) {
      if (t.type !== 'expense' || !t.note) continue
      const key = t.note.trim()
      const e = byNote.get(key) || { months: new Set<string>(), total: 0, count: 0 }
      e.months.add(t.date.slice(0, 7))
      e.total += t.amount
      e.count++
      byNote.set(key, e)
    }
    const arr = [...byNote.entries()]
      .filter(([, e]) => e.months.size >= 2)
      .map(([note, e]) => ({ note, months: e.months.size, count: e.count, total: Math.round(e.total), perMonth: Math.round(e.total / e.months.size) }))
      .sort((a, b) => b.total - a.total)
    return arr
  }, [data.transactions])
  const annual = subs.reduce((a, s) => a + s.perMonth * 12, 0)
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-400 mb-3">识别"备注相同且出现 ≥2 个月"的支出，可能为订阅/固定开销（如视频会员、话费）。建议记账时备注写固定名称（如"腾讯视频会员"）。</p>
      {subs.length === 0 && <div className="text-center py-8 text-slate-300 text-sm">暂未识别到固定订阅</div>}
      <div className="divide-y divide-slate-50">
        {subs.map((s) => (
          <div key={s.note} className="flex items-center py-2.5 text-sm">
            <div className="flex-1 min-w-0"><div className="truncate font-medium">{s.note}</div><div className="text-[11px] text-slate-400">近 {s.months} 个月共 {s.count} 笔</div></div>
            <div className="text-right"><div className="num">约 ¥{s.perMonth}/月</div><div className="text-[11px] text-slate-400 num">全年 ≈ ¥{s.perMonth * 12}</div></div>
          </div>
        ))}
      </div>
      {subs.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm flex justify-between"><span className="text-amber-700 font-medium">估算年度固定支出</span><b className="num text-amber-700">¥{annual.toLocaleString()}</b></div>}
    </Card>
  )
}




