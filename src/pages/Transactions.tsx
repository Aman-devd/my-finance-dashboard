import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { Button, Card, Empty, Field, Modal, PageHead, Segmented, Select, TextInput, Tag, cx } from '../components/ui'
import { Plus, Trash2 } from 'lucide-react'
import type { Transaction } from '../types'

type Filter = 'all' | 'expense' | 'income' | 'transfer' | 'repay'

export default function Transactions() {
  const { data, deleteTransaction, updateTransaction } = useApp()
  const months = useMemo(() => {
    const set = new Set(data.transactions.map((t) => t.date.slice(0, 7)))
    if (!set.has(dayjs().format('YYYY-MM'))) set.add(dayjs().format('YYYY-MM'))
    return [...set].sort((a, b) => (a < b ? 1 : -1))
  }, [data.transactions])
  const [month, setMonth] = useState(months[0] || dayjs().format('YYYY-MM'))
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)

  const accName = (id?: string) => data.accounts.find((a) => a.id === id)?.name || '已删除账户'
  const catOf = (id?: string) => data.categories.find((c) => c.id === id)

  const list = useMemo(() => {
    let arr = data.transactions.filter((t) => t.date.startsWith(month))
    if (filter !== 'all') arr = arr.filter((t) => t.type === filter)
    if (q.trim()) {
      const kw = q.trim()
      arr = arr.filter((t) => (t.note || '').includes(kw) || (catOf(t.categoryId)?.name || '').includes(kw) || accName(t.accountId).includes(kw))
    }
    return [...arr].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [data.transactions, month, filter, q])

  const summary = useMemo(() => {
    const txs = data.transactions.filter((t) => t.date.startsWith(month))
    const income = txs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
    return { income, expense }
  }, [data.transactions, month])

  const groups: { date: string; items: Transaction[] }[] = []
  for (const t of list) {
    const last = groups[groups.length - 1]
    if (last && last.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }

  const typeLabel: Record<Transaction['type'], string> = { expense: '支出', income: '收入', transfer: '转账', repay: '还款' }
  const typeTone: Record<Transaction['type'], 'red' | 'green' | 'blue' | 'violet'> = { expense: 'red', income: 'green', transfer: 'blue', repay: 'violet' }

  const fm = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })

  return (
    <div>
      <PageHead title="账单流水" sub={`${month} 共 ${list.length} 笔`} right={<Link to="/add"><Button><Plus size={16} /> 记一笔</Button></Link>} />

      <Card className="p-4 grid grid-cols-3 gap-2 text-center mb-3">
        <div><div className="text-[11px] text-slate-400">收入</div><div className="text-emerald-600 font-bold num text-lg">+{fm(summary.income)}</div></div>
        <div><div className="text-[11px] text-slate-400">支出</div><div className="text-red-500 font-bold num text-lg">-{fm(summary.expense)}</div></div>
        <div><div className="text-[11px] text-slate-400">结余</div><div className="text-slate-800 font-bold num text-lg">{fm(summary.income - summary.expense)}</div></div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Segmented options={[{ value: 'all', label: '全部' }, { value: 'expense', label: '支出' }, { value: 'income', label: '收入' }, { value: 'transfer', label: '转账' }, { value: 'repay', label: '还款' }]} value={filter} onChange={(v) => setFilter(v as Filter)} />
        </div>
        <div className="flex-1 flex gap-2">
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="!w-36">
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <TextInput placeholder="搜索备注/分类/账户" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
        </div>
      </div>

      {groups.length === 0 && <Card><Empty text="这个月还没有账单" action={<Link to="/add"><Button><Plus size={16} /> 记一笔</Button></Link>} /></Card>}

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.date}>
            <div className="text-[11px] text-slate-400 font-medium px-1 mb-1">{dayjs(g.date).format('YYYY年M月D日')} 周{'日一二三四五六'[dayjs(g.date).day()]}</div>
            <Card className="divide-y divide-slate-50 overflow-hidden">
              {g.items.map((t) => {
                const cat = catOf(t.categoryId)
                return (
                  <button key={t.id} onClick={() => setEditing(t)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <span className="w-9 h-9 rounded-full grid place-items-center shrink-0" style={{ background: (cat?.color || '#94a3b8') + '22', color: cat?.color || '#64748b' }}>
                      {t.type === 'income' ? '收' : t.type === 'expense' ? '支' : t.type === 'repay' ? '还' : '转'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm flex items-center gap-1.5"><span className="truncate font-medium">{t.note || cat?.name || typeLabel[t.type]}</span>{t.type === 'repay' && <Tag tone="violet">{accName(t.toAccountId)}</Tag>}</div>
                      <div className="text-[11px] text-slate-400 truncate">{cat ? cat.name + ' · ' : ''}{accName(t.accountId)}{t.type === 'transfer' && ` → ${accName(t.toAccountId)}`}</div>
                    </div>
                    <div className="text-right">
                      <div className={cx('text-sm num font-semibold', t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' || t.type === 'repay' ? 'text-slate-800' : 'text-blue-600')}>
                        {t.type === 'income' ? '+' : t.type === 'expense' || t.type === 'repay' ? '-' : ''}{fm(t.amount)}
                      </div>
                      <Tag tone={typeTone[t.type]}>{typeLabel[t.type]}</Tag>
                    </div>
                  </button>
                )
              })}
            </Card>
          </div>
        ))}
      </div>

      {editing && <EditTxModal tx={editing} accounts={data.accounts} cats={data.categories.filter((c) => c.type === (editing.type === 'income' ? 'income' : 'expense'))} onClose={() => setEditing(null)} onSave={(patch) => { updateTransaction(editing.id, patch); setEditing(null) }} onDelete={() => { deleteTransaction(editing.id); setEditing(null) }} />}
    </div>
  )
}

function EditTxModal({ tx, accounts, cats, onClose, onSave, onDelete }: {
  tx: Transaction
  accounts: { id: string; name: string }[]
  cats: { id: string; name: string }[]
  onClose: () => void
  onSave: (patch: { date?: string; amount?: number; categoryId?: string; note?: string }) => void
  onDelete: () => void
}) {
  const [date, setDate] = useState(tx.date)
  const [amount, setAmount] = useState(String(tx.amount))
  const [categoryId, setCategoryId] = useState(tx.categoryId || '')
  const [note, setNote] = useState(tx.note || '')

  return (
    <Modal open title="修改账单" onClose={onClose}
      footer={<><Button variant="danger" onClick={onDelete}><Trash2 size={15} /> 删除</Button><Button onClick={() => onSave({ date, amount: parseFloat(amount) || tx.amount, categoryId: categoryId || undefined, note: note || undefined })}>保存</Button></>}>
      <div className="space-y-3">
        {tx.type !== 'transfer' && tx.type !== 'repay' && (
          <Field label="分类">
            <div className="flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <button key={c.id} onClick={() => setCategoryId(c.id)} className={cx('px-2.5 py-1 rounded-lg text-xs border', categoryId === c.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600')}>{c.name}</button>
              ))}
            </div>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="金额"><TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="日期"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="备注"><TextInput value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="text-[11px] text-slate-400">账户与类型不可在此修改（{accounts.find((a) => a.id === tx.accountId)?.name || ''}）</div>
      </div>
    </Modal>
  )
}

