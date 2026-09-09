import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { Button, Card, Field, Segmented, TextInput, Select, TextArea, cx } from '../components/ui'
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, HandCoins } from 'lucide-react'

type FormType = 'expense' | 'income' | 'transfer' | 'repay'

const TYPE_META: { v: FormType; label: string; color: string; bg: string }[] = [
  { v: 'expense', label: '支出', color: '#dc2626', bg: 'bg-red-50 text-red-600' },
  { v: 'income', label: '收入', color: '#16a34a', bg: 'bg-emerald-50 text-emerald-600' },
  { v: 'transfer', label: '转账', color: '#2563eb', bg: 'bg-blue-50 text-blue-600' },
  { v: 'repay', label: '还款', color: '#7c3aed', bg: 'bg-violet-50 text-violet-600' },
]

export default function AddTransaction() {
  const { data, addTransaction } = useApp()
  const nav = useNavigate()
  const [type, setType] = useState<FormType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const assetAccounts = data.accounts.filter((a) => a.category !== 'loan' && !a.archived)
  const loans = data.accounts.filter((a) => a.category === 'loan' && !a.archived)
  const cashLike = data.accounts.filter((a) => ['cash', 'bank', 'alipay', 'wechat'].includes(a.category) && !a.archived)

  const cats = useMemo(() => {
    if (type === 'income') return data.categories.filter((c) => c.type === 'income')
    if (type === 'expense') return data.categories.filter((c) => c.type === 'expense' && c.id !== 'c-repay')
    return []
  }, [type, data.categories])

  const meta = TYPE_META.find((m) => m.v === type)!

  const srcAccounts = type === 'repay' ? cashLike : assetAccounts

  const quickAmounts = ['50', '100', '300', '1000', '3000']

  function submit() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setErr('请输入有效金额'); return }
    if (!accountId) { setErr('请选择账户'); return }
    if ((type === 'transfer' || type === 'repay') && !toAccountId) { setErr(type === 'repay' ? '请选择要还的负债' : '请选择转入账户'); return }
    if (type === 'repay') {
      const loan = loans.find((l) => l.id === toAccountId)
      if (loan && amt > loan.balance) { setErr(`还款金额超过剩余欠款 ¥${Math.round(loan.balance * 100) / 100}，请核实后再还`); return }
    }
    setErr('')
    addTransaction({
      date, type, amount: Math.round(amt * 100) / 100,
      accountId,
      toAccountId: type === 'transfer' || type === 'repay' ? toAccountId : undefined,
      categoryId: type === 'expense' ? categoryId || undefined : type === 'income' ? categoryId || undefined : type === 'repay' ? 'c-repay' : undefined,
      note: note || undefined,
    })
    nav('/transactions', { replace: true })
  }

  const iconCls = 'w-16 h-16 rounded-2xl grid place-items-center text-white shadow-sm'
  return (
    <div className="max-w-xl mx-auto space-y-5">
      <Card className="p-5">
        <div className="grid grid-cols-4 gap-2">
          {TYPE_META.map((m) => (
            <button key={m.v} onClick={() => { setType(m.v); setCategoryId(''); setToAccountId('') }} className={cx('flex flex-col items-center gap-1 py-2.5 rounded-2xl text-xs font-medium border transition', type === m.v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500')}>
              <span className="text-base leading-none">{m.v === 'expense' ? <ArrowUpRight size={18} /> : m.v === 'income' ? <ArrowDownLeft size={18} /> : m.v === 'transfer' ? <ArrowLeftRight size={18} /> : <HandCoins size={18} />}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className={cx(iconCls)} style={{ background: meta.color }}>
            {type === 'expense' ? <ArrowUpRight size={28} /> : type === 'income' ? <ArrowDownLeft size={28} /> : type === 'transfer' ? <ArrowLeftRight size={26} /> : <HandCoins size={26} />}
          </div>
          <div className="flex-1">
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              className="w-full input-lg font-bold num outline-none placeholder:text-slate-300"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {quickAmounts.map((q) => <button key={q} onClick={() => setAmount(q)} className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">{q}</button>)}
        </div>
        {err && <div className="text-xs text-red-500 mt-2">{err}</div>}
      </Card>

      {(type === 'expense' || type === 'income') && (
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-500 mb-2">分类</div>
          <div className="grid grid-cols-4 gap-2">
            {cats.map((c) => (
              <button key={c.id} onClick={() => setCategoryId(c.id)} className={cx('rounded-xl border p-2 text-center text-xs transition', categoryId === c.id ? 'border-transparent ring-2' : 'border-slate-100 bg-white text-slate-600')} style={categoryId === c.id ? { background: c.color + '14', color: c.color, ['--tw-ring-color' as string]: c.color } : undefined}>
                <span className="block w-6 h-6 mx-auto rounded-lg mb-1" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <Field label={type === 'repay' ? '从哪个账户还款' : '账户'}>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">选择账户</option>
            {srcAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        {type === 'transfer' && (
          <Field label="转到">
            <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">选择转入账户</option>
              {assetAccounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        )}
        {type === 'repay' && (
          <Field label="还哪笔负债">
            <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">选择负债</option>
              {loans.map((a) => <option key={a.id} value={a.id}>{a.name}（欠 ¥{a.balance.toFixed(0)}）</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="日期">
            <TextInput type="date" value={date} max={dayjs().format('YYYY-MM-DD')} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="金额备注">
            <TextInput placeholder="备注（选填）" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        {type === 'repay' && loans.find((l) => l.id === toAccountId)?.loan?.monthlyPayment ? (
          <button type="button" onClick={() => setAmount(String(loans.find((l) => l.id === toAccountId)!.loan!.monthlyPayment))} className="text-xs text-blue-600">一键填入月供 {loans.find((l) => l.id === toAccountId)!.loan!.monthlyPayment.toFixed(0)} 元</button>
        ) : null}
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => nav(-1)}>取消</Button>
        <Button className="flex-[2]" style={{ background: meta.color }} onClick={submit}>保存{type === 'repay' ? '还款' : type === 'transfer' ? '转账' : '账单'}</Button>
      </div>
    </div>
  )
}






