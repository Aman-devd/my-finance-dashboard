import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { Button, Card, DateInput, Empty, Field, Modal, PageHead, Select, Tag, TextInput, cx } from '../components/ui'
import { Plus, Pencil, Trash2, HandCoins, CheckCircle2, RotateCcw } from 'lucide-react'
import type { Borrow, BorrowKind } from '../types'

export default function BorrowPage() {
  const { data, addBorrow, updateBorrow, deleteBorrow } = useApp()
  const [form, setForm] = useState<{ open: boolean; item?: Borrow }>({ open: false })

  const active = data.borrows.filter((b) => !b.settled)
  const lendTotal = active.filter((b) => b.kind === 'lend').reduce((s, b) => s + b.amount, 0)
  const borrowTotal = active.filter((b) => b.kind === 'borrow').reduce((s, b) => s + b.amount, 0)
  const settledCount = data.borrows.filter((b) => b.settled).length

  const lendList = useMemo(() => data.borrows.filter((b) => b.kind === 'lend').sort((a, b) => Number(a.settled) - Number(b.settled) || (a.date < b.date ? 1 : -1)), [data.borrows])
  const borrowList = useMemo(() => data.borrows.filter((b) => b.kind === 'borrow').sort((a, b) => Number(a.settled) - Number(b.settled) || (a.date < b.date ? 1 : -1)), [data.borrows])

  const dueTag = (b: Borrow) => {
    if (b.settled) return <Tag tone="slate">已结清</Tag>
    if (!b.dueDate) return null
    const diff = dayjs(b.dueDate).diff(dayjs().startOf('day'), 'day')
    if (diff < 0) return <Tag tone="red">已逾期 {Math.abs(diff)} 天</Tag>
    if (diff <= 7) return <Tag tone="amber">{diff === 0 ? '今天到期' : `${diff} 天后到期`}</Tag>
    return <Tag tone="blue">{diff} 天后到期</Tag>
  }

  const ListRow = ({ b }: { b: Borrow }) => (
    <div className={cx('px-4 py-3 flex items-center gap-3', b.settled && 'opacity-55')}>
      <span className={cx('w-9 h-9 rounded-full grid place-items-center text-white shrink-0', b.kind === 'lend' ? 'bg-emerald-500' : 'bg-violet-500')}>
        <HandCoins size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium flex items-center gap-1.5">{b.person} {dueTag(b)}</div>
        <div className="text-[11px] text-slate-400 truncate">{b.date}{b.note ? ` · ${b.note}` : ''}{b.settledDate ? ` · 结清于 ${b.settledDate}` : ''}</div>
      </div>
      <div className="text-right">
        <div className={cx('num font-bold', b.settled ? 'text-slate-400 line-through' : b.kind === 'lend' ? 'text-emerald-600' : 'text-violet-600')}>
          {b.kind === 'lend' ? '+' : '-'}¥{b.amount.toLocaleString()}
        </div>
        {b.kind === 'lend' && !b.settled && <div className="text-[10px] text-slate-300">应收</div>}
        {b.kind === 'borrow' && !b.settled && <div className="text-[10px] text-slate-300">应付</div>}
      </div>
      <div className="flex flex-col gap-1">
        {!b.settled ? (
          <button onClick={() => updateBorrow(b.id, { settled: true, settledDate: dayjs().format('YYYY-MM-DD') })} className="text-[11px] text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={11} /> 结清</button>
        ) : (
          <button onClick={() => updateBorrow(b.id, { settled: false, settledDate: undefined })} className="text-[11px] text-slate-400 flex items-center gap-0.5"><RotateCcw size={11} /> 恢复</button>
        )}
        <button onClick={() => setForm({ open: true, item: b })} className="text-[11px] text-slate-400"><Pencil size={11} /></button>
        <button onClick={() => { if (window.confirm(`删除这条${b.kind === 'lend' ? '借出' : '借入'}记录？`)) deleteBorrow(b.id) }} className="text-[11px] text-red-400"><Trash2 size={11} /></button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHead title="借出借入" sub="谁欠我、我欠谁，一目了然" right={<Button onClick={() => setForm({ open: true })}><Plus size={16} /> 记一笔借贷</Button>} />

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center"><div className="text-[11px] text-slate-400">借出未还（应收）</div><div className="text-emerald-600 font-bold num mt-0.5">¥{lendTotal.toLocaleString()}</div></Card>
        <Card className="p-3 text-center"><div className="text-[11px] text-slate-400">借入未还（应付）</div><div className="text-violet-600 font-bold num mt-0.5">¥{borrowTotal.toLocaleString()}</div></Card>
        <Card className="p-3 text-center"><div className="text-[11px] text-slate-400">净应收</div><div className={cx('font-bold num mt-0.5', lendTotal - borrowTotal >= 0 ? 'text-slate-800' : 'text-red-500')}>¥{(lendTotal - borrowTotal).toLocaleString()}</div></Card>
      </div>

      {data.borrows.length === 0 && <Card><Empty text="还没有借贷记录，先记一笔吧" /></Card>}

      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-2 text-sm font-semibold flex items-center justify-between"><span>我借出的（别人欠我）</span><span className="text-[11px] font-normal text-slate-400">{lendList.filter((b) => !b.settled).length} 笔未结清</span></div>
        {lendList.length === 0 ? <div className="px-4 pb-4 text-xs text-slate-300">暂无</div> : <div className="divide-y divide-slate-50">{lendList.map((b) => <ListRow key={b.id} b={b} />)}</div>}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-2 text-sm font-semibold flex items-center justify-between"><span>我借入的（我欠别人）</span><span className="text-[11px] font-normal text-slate-400">{borrowList.filter((b) => !b.settled).length} 笔未结清</span></div>
        {borrowList.length === 0 ? <div className="px-4 pb-4 text-xs text-slate-300">暂无</div> : <div className="divide-y divide-slate-50">{borrowList.map((b) => <ListRow key={b.id} b={b} />)}</div>}
      </Card>

      {settledCount > 0 && <p className="text-[11px] text-slate-400 text-center">共 {settledCount} 笔已结清（显示在列表底部，灰色斜线为已结清）</p>}

      {form.open && <BorrowForm item={form.item} onClose={() => setForm({ open: false })} onSave={(b) => { if (form.item) updateBorrow(form.item.id, b); else addBorrow({ ...b, settled: false }); setForm({ open: false }) }} />}
    </div>
  )
}

function BorrowForm({ item, onClose, onSave }: { item?: Borrow; onClose: () => void; onSave: (b: Omit<Borrow, 'id' | 'settled' | 'settledDate'>) => void }) {
  const [kind, setKind] = useState<BorrowKind>(item?.kind || 'lend')
  const [person, setPerson] = useState(item?.person || '')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [date, setDate] = useState(item?.date || dayjs().format('YYYY-MM-DD'))
  const [dueDate, setDueDate] = useState(item?.dueDate || '')
  const [note, setNote] = useState(item?.note || '')
  const amt = parseFloat(amount) || 0
  const ok = person.trim() && amt > 0
  return (
    <Modal open title={item ? '编辑借贷' : '记一笔借贷'} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!ok} onClick={() => onSave({ kind, person: person.trim(), amount: Math.round(amt * 100) / 100, date, dueDate: dueDate || undefined, note: note || undefined })}>保存</Button></>}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {([['lend', '我借出（别人欠我）', 'emerald'], ['borrow', '我借入（我欠别人）', 'violet']] as const).map(([v, l, tone]) => (
            <button key={v} onClick={() => setKind(v)} className={cx('flex-1 py-2 rounded-xl border text-sm', kind === v ? (tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-600 font-medium' : 'border-violet-300 bg-violet-50 text-violet-600 font-medium') : 'border-slate-200 text-slate-500')}>{l}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === 'lend' ? '借给谁' : '向谁借'}><TextInput value={person} onChange={(e) => setPerson(e.target.value)} placeholder="姓名/称呼" /></Field>
          <Field label="金额"><TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="发生日期"><DateInput value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="约定还款日（可选）"><DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>
        <Field label="备注"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：为什么借/利息约定" /></Field>
        <div className="text-[11px] text-slate-400">设了还款日会进入「提醒中心-理财提醒」，到期前自动提醒你。</div>
      </div>
    </Modal>
  )
}

