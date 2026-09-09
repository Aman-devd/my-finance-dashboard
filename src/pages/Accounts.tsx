import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../lib/store'
import { accountAssetValue, totalAssets, totalDebt, netWorth, holdingsOf } from '../lib/values'
import { moneyShort } from '../lib/format'
import { Button, Card, DateInput, Empty, Field, Modal, PageHead, Select, TextInput, TextArea, Tag, cx } from '../components/ui'
import { Plus, Pencil, Trash2, HandCoins, Landmark, Coins, CreditCard, Smartphone, Wallet, Briefcase, TrendingUp } from 'lucide-react'
import type { Account, AccountCategory } from '../types'
import dayjs from 'dayjs'

const CAT_LABEL: Record<AccountCategory, string> = { cash: '现金', bank: '银行卡', alipay: '支付宝', wechat: '微信', securities: '证券账户', fund: '公积金', loan: '负债' }
const CAT_ICON: Record<AccountCategory, React.ReactNode> = {
  cash: <Wallet size={16} />, bank: <CreditCard size={16} />, alipay: <Smartphone size={16} />, wechat: <Coins size={16} />, securities: <TrendingUp size={16} />, fund: <Landmark size={16} />, loan: <Briefcase size={16} />,
}

export default function Accounts() {
  const { data, addAccount, updateAccount, deleteAccount, addTransaction } = useApp()
  const [form, setForm] = useState<{ open: boolean; account?: Account }>({ open: false })
  const [repayFor, setRepayFor] = useState<Account | null>(null)
  const [toast, setToast] = useState('')

  const groups: { title: string; ids: string[] }[] = [
    { title: '现金及电子账户', ids: data.accounts.filter((a) => ['cash', 'bank', 'alipay', 'wechat'].includes(a.category)).map((a) => a.id) },
    { title: '证券账户', ids: data.accounts.filter((a) => a.category === 'securities').map((a) => a.id) },
    { title: '公积金', ids: data.accounts.filter((a) => a.category === 'fund').map((a) => a.id) },
    { title: '负债（欠款）', ids: data.accounts.filter((a) => a.category === 'loan').map((a) => a.id) },
  ].filter((g) => g.ids.length)

  const fm = (n: number) => Math.round(n * 100) / 100

  function del(a: Account) {
    if (window.confirm(`删除账户「${a.name}」？其账单/持仓记录会一并删除。`)) deleteAccount(a.id)
  }

  return (
    <div>
            {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-[#1d1d1f] text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">{toast}</div>}
<PageHead title="账户管理" sub="净资产 = 总资产 − 总负债" right={<Button onClick={() => setForm({ open: true })}><Plus size={16} /> 添加账户</Button>} />

      <div className="grid grid-cols-3 gap-2 mb-4">
        <SumCard label="总资产" value={fm(totalAssets(data))} cls="text-slate-800" />
        <SumCard label="总负债" value={fm(totalDebt(data))} cls="text-red-500" />
        <SumCard label="净资产" value={fm(netWorth(data))} cls="text-emerald-600" />
      </div>

      {groups.length === 0 && <Card><Empty text="还没有账户，先添加一个吧" /></Card>}

      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="text-xs font-semibold text-slate-500 mb-1.5 px-1">{g.title}</div>
            <Card className="divide-y divide-slate-50 overflow-hidden">
              {g.ids.map((id) => {
                const a = data.accounts.find((x) => x.id === id)!
                const isLoan = a.category === 'loan'
                const val = isLoan ? a.balance : accountAssetValue(a, data)
                const holdings = holdingsOf(data, id)
                return (
                  <div key={id} className="px-4 py-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: isLoan ? '#7c3aed' : a.category === 'securities' ? '#8b5cf6' : a.category === 'fund' ? '#f59e0b' : '#2563eb' }}>{CAT_ICON[a.category]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-1.5">{a.name}{a.archived && <Tag>已归档</Tag>}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {isLoan
                          ? `剩余 ${a.loan ? `· 利率${a.loan.ratePct}% · 月供¥${a.loan.monthlyPayment.toFixed(0)}` : ''}`
                          : a.category === 'securities'
                            ? `可用现金 ¥${fm(a.balance)} · ${holdings.length} 只持仓`
                            : a.category === 'fund'
                              ? '公积金余额'
                              : CAT_LABEL[a.category]}
                        {a.note ? ` · ${a.note}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cx('font-bold num', isLoan ? 'text-violet-600' : 'text-slate-800')}>{isLoan ? '欠 ' : ''}¥ {fm(val).toLocaleString()}</div>
                      <div className="flex justify-end gap-1 mt-1">
                        {isLoan && (
                          <button onClick={() => setRepayFor(a)} className="text-[11px] text-blue-600 flex items-center gap-0.5"><HandCoins size={11} /> 还款</button>
                        )}
                        <button onClick={() => setForm({ open: true, account: a })} className="text-[11px] text-slate-400"><Pencil size={12} /></button>
                        <button onClick={() => del(a)} className="text-[11px] text-red-400"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>
        ))}
      </div>

      {form.open && <AccountForm account={form.account} onClose={() => setForm({ open: false })} onSave={(a) => { if (form.account) { updateAccount(form.account.id, a); setToast('账户已更新') } else { addAccount(a); setToast('账户已保存') }; setForm({ open: false }); window.setTimeout(() => setToast(''), 2200) }} />}
      {repayFor && <RepayModal loan={repayFor} cashAccounts={data.accounts.filter((a) => ['cash', 'bank', 'alipay', 'wechat'].includes(a.category))} onClose={() => setRepayFor(null)} onOk={(sourceId, amount, date) => { addTransaction({ date, type: 'repay', amount, accountId: sourceId, toAccountId: repayFor.id, categoryId: 'c-repay', note: `${repayFor.name}还款` }); setRepayFor(null) }} />}
    </div>
  )
}

function SumCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={cx('num font-bold text-base md:text-lg mt-0.5', cls)} title={String(value)}>¥ {moneyShort(value)}</div>
    </Card>
  )
}

function AccountForm({ account, onClose, onSave }: { account?: Account; onClose: () => void; onSave: (a: Omit<Account, 'id'>) => void }) {
  const [err, setErr] = useState('')
  const isEdit = !!account
  const [category, setCategory] = useState<AccountCategory>(account?.category || 'bank')
  const [name, setName] = useState(account?.name || '')
  const [balance, setBalance] = useState(account ? String(account.balance) : '')
  const [rate, setRate] = useState(account?.loan ? String(account.loan.ratePct) : '')
  const [monthly, setMonthly] = useState(account?.loan ? String(account.loan.monthlyPayment) : '')
  const [dueDay, setDueDay] = useState(account?.loan ? String(account.loan.dueDay) : '')
  const [note, setNote] = useState(account?.note || '')

  const catOptions = (Object.keys(CAT_LABEL) as AccountCategory[]).map((c) => ({ value: c, label: CAT_LABEL[c] }))

  function save() {
    const cleanBal = balance.replace(/[,\s¥￥]/g, '')
    if (!name.trim()) { setErr('请填写账户名称'); return }
    if (cleanBal === '' || isNaN(parseFloat(cleanBal))) { setErr('请填写有效的当前余额（数字）'); return }
    const bal = parseFloat(cleanBal)
    if (category === 'loan') {
      if (isNaN(parseFloat(rate)) || parseFloat(rate) < 0 || isNaN(parseFloat(monthly)) || monthly === '' || dueDay === '') { setErr('负债账户请填写 年利率、月供 和 还款日'); return }
    }
    setErr('')
    onSave({
      name: name.trim(), category, balance: bal, note: note || undefined, icon: '', archived: false,
      loan: category === 'loan' ? { ratePct: parseFloat(rate) || 0, monthlyPayment: parseFloat(monthly) || 0, dueDay: Math.min(28, Math.max(1, parseInt(dueDay) || 1)), startDate: account?.loan?.startDate || dayjs().format('YYYY-MM-DD') } : undefined,
    })
  }

  return (
    <Modal open title={isEdit ? '编辑账户' : '添加账户'} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button onClick={save}>保存</Button></>}>
      <div className="space-y-3">
        {!isEdit && (
          <Field label="类型">
            <div className="flex flex-wrap gap-1.5">
              {catOptions.map((o) => <button key={o.value} onClick={() => setCategory(o.value)} className={cx('px-2.5 py-1.5 rounded-lg text-xs border', category === o.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600')}>{o.label}</button>)}
            </div>
          </Field>
        )}
        <Field label="名称"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={category === 'loan' ? '如：车贷' : category === 'fund' ? '公积金' : '如：招商银行卡'} /></Field>
        <Field label={category === 'loan' ? '当前欠款金额' : category === 'securities' ? '账户可用现金' : '当前余额'}>
          <TextInput inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </Field>
        {category === 'loan' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Field label="年利率%"><TextInput inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
              <Field label="月供"><TextInput inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></Field>
              <Field label="还款日"><Select value={dueDay} onChange={(e) => setDueDay(e.target.value)}>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={String(d)}>{d}号</option>)}</Select></Field>
            </div>
            <div className="text-[11px] text-slate-400">系统会在还款日前提醒你，并在你还款后自动减少欠款。</div>
          </>
        )}
        <Field label="备注"><TextArea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {err && <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
      </div>
    </Modal>
  )
}

function RepayModal({ loan, cashAccounts, onClose, onOk }: { loan: Account; cashAccounts: Account[]; onClose: () => void; onOk: (sourceId: string, amount: number, date: string) => void }) {
  const [source, setSource] = useState(cashAccounts[0]?.id || '')
  const [amount, setAmount] = useState(String(loan.loan?.monthlyPayment || ''))
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const amt = parseFloat(amount) || 0
  return (
    <Modal open title={`给「${loan.name}」还款`} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!source || amt <= 0 || amt > loan.balance} onClick={() => onOk(source, amt, date)}>确认还款 ¥{amt.toFixed(0)}</Button></>}>
      <div className="space-y-3">
        <div className="rounded-xl bg-violet-50 p-3 text-sm text-violet-700">剩余欠款 ¥{loan.balance.toLocaleString()}{loan.loan?.ratePct ? ` · 利率 ${loan.loan.ratePct}%` : ''}</div>
        <Field label="还款账户"><Select value={source} onChange={(e) => setSource(e.target.value)}>{cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}（¥{a.balance.toFixed(0)}）</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="还款金额"><TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="日期"><DateInput value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {amt > loan.balance && <div className="text-xs text-amber-600">还款金额不能超过剩余欠款 ¥{loan.balance.toFixed(0)}。</div>}
        {amt < loan.balance && loan.balance > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-400">剩余欠款 ¥{loan.balance.toFixed(0)}</span>
            <button type="button" onClick={() => setAmount(String(Math.round(loan.balance * 100) / 100))} className="text-xs text-blue-600">一键填入剩余欠款</button>
          </div>
        )}
      </div>
    </Modal>
  )
}





