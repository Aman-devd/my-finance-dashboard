import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { upcomingReminders, type Reminder } from '../lib/reminders'
import { Button, Card, Empty, Field, Modal, PageHead, Tag, TextInput, cx } from '../components/ui'
import { Bell, Cake, HandCoins, Wrench, ShieldCheck, BadgeCheck, CalendarDays, Settings2, Plus, CalendarPlus, Trash2, Sparkles } from 'lucide-react'

const KIND_ICON: Record<string, React.ReactNode> = {
  生日: <Cake size={16} className="text-pink-500" />, 纪念日: <Sparkles size={16} className="text-fuchsia-400" />,
  还款: <HandCoins size={16} className="text-violet-500" />, 借贷: <HandCoins size={16} className="text-emerald-500" />,
  保养: <Wrench size={16} className="text-amber-500" />, 车险: <ShieldCheck size={16} className="text-blue-500" />,
  年检: <BadgeCheck size={16} className="text-cyan-500" />, 财经事件: <CalendarDays size={16} className="text-amber-600" />,
  自定义: <Bell size={16} className="text-slate-500" />,
}

export default function Reminders() {
  const { data, setSettings, addCustomReminder, deleteCustomReminder } = useApp()
  const [showSettings, setShowSettings] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [advB, setAdvB] = useState(String(data.settings.birthdayAdvanceDays))
  const [advR, setAdvR] = useState(String(data.settings.repaymentAdvanceDays))

  const all = useMemo(() => upcomingReminders(data, 60), [data])
  const personal = all.filter((r) => r.group === 'personal')
  const financial = all.filter((r) => r.group === 'financial')
  const urgentCount = all.filter((r) => r.daysLeft <= 5).length

  const daysTxt = (n: number) => n === 0 ? '今天' : n === 1 ? '明天' : `${n} 天后`

  const Row = ({ r }: { r: Reminder }) => (
    <div key={r.id} className="flex items-center gap-2.5 py-2.5">
      {KIND_ICON[r.kind]}
      <div className="flex-1 min-w-0">
        <div className="text-sm">{r.title}</div>
        <div className="text-[11px] text-slate-500 truncate">{r.sub} · {r.date.format('M月D日')}</div>
      </div>
      <Tag tone={r.daysLeft === 0 ? 'red' : r.daysLeft <= 3 ? 'amber' : r.daysLeft <= 5 ? 'blue' : 'slate'}>{daysTxt(r.daysLeft)}</Tag>
      {r.kind === '自定义' && <button onClick={() => deleteCustomReminder(r.id.replace(/^crx-/, '').replace(/-\d{6}$/, ''))} className="text-slate-300 hover:text-red-400"><Trash2 size={14} /></button>}
    </div>
  )

  const Section = ({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: Reminder[]; tone: 'pink' | 'blue' }) => (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-bold flex items-center gap-1.5">{icon} {title}</div>
        <span className="text-[11px] text-slate-400 num">{items.length} 项</span>
      </div>
      <div className="text-[11px] text-slate-400 mb-1">{items.length ? '按时间排序，紧急项红/橙高亮' : ''}</div>
      {items.length === 0 ? <div className="text-xs text-slate-300 py-3">暂无</div> : <div className="divide-y divide-slate-50">{items.map((r) => <Row key={r.id} r={r} />)}</div>}
    </Card>
  )

  return (
    <div className="space-y-5">
      <PageHead title="提醒中心" sub="个人事项在上 · 理财提醒在下" right={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAdd(true)}><CalendarPlus size={15} /> 设置提醒</Button>
          <Button variant="ghost" onClick={() => setShowSettings(true)}><Settings2 size={15} /></Button>
        </div>
      } />

      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <span>📅 个人事项 <b className="num">{personal.length}</b> 项</span>
        <span>💰 理财提醒 <b className="num">{financial.length}</b> 项</span>
        {urgentCount > 0 && <span className="text-red-500 font-medium">⏰ 近 5 天 {urgentCount} 项待处理</span>}
      </div>

      {/* 个人事项在上 */}
      <Section title="个人事项" icon={<Sparkles size={15} className="text-fuchsia-500" />} items={personal} tone="pink" />

      {/* 理财提醒在下 */}
      <Section title="理财提醒" icon={<HandCoins size={15} className="text-violet-500" />} items={financial} tone="blue" />

      <p className="text-[11px] text-slate-400 leading-5 px-1">
        个人事项 = 生日 / 纪念日 / 车辆保养·车险·年检 / 生活类自定义；理财提醒 = 贷款还款 / 借出借入到期 / 财经事件 / 理财类自定义。
        「设置提醒」可添加自己的提醒，并选择归入哪一类。
      </p>

      {showSettings && (
        <Modal open title="提醒提前量" onClose={() => setShowSettings(false)} footer={<><Button variant="soft" onClick={() => setShowSettings(false)}>取消</Button><Button onClick={() => { setSettings({ birthdayAdvanceDays: Math.max(0, parseInt(advB) || 0), repaymentAdvanceDays: Math.max(0, parseInt(advR) || 0) }); setShowSettings(false) }}>保存</Button></>}>
          <div className="space-y-3">
            <Field label="生日/纪念日提前几天（提醒到当天）"><TextInput inputMode="numeric" value={advB} onChange={(e) => setAdvB(e.target.value)} /></Field>
            <Field label="还款提前几天"><TextInput inputMode="numeric" value={advR} onChange={(e) => setAdvR(e.target.value)} /></Field>
          </div>
        </Modal>
      )}

      {showAdd && <CustomReminderForm onClose={() => setShowAdd(false)} onSave={(c) => { addCustomReminder(c); setShowAdd(false) }} />}
    </div>
  )
}

function CustomReminderForm({ onClose, onSave }: { onClose: () => void; onSave: (c: { title: string; date: string; repeat: 'once' | 'yearly' | 'monthly'; category: 'financial' | 'personal'; note?: string }) => void }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<'personal' | 'financial'>('personal')
  const [repeat, setRepeat] = useState<'once' | 'yearly' | 'monthly'>('once')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [note, setNote] = useState('')
  const ok = title.trim() && !!date
  return (
    <Modal open title="设置提醒" onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!ok} onClick={() => onSave({ title: title.trim(), date, repeat, category, note: note || undefined })}>保存</Button></>}>
      <div className="space-y-3">
        <Field label="提醒内容"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：交水电费 / 还朋友钱" /></Field>
        <Field label="归入哪一类">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setCategory('personal')} className={cx('py-2 rounded-xl border text-sm', category === 'personal' ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-600 font-medium' : 'border-slate-200 text-slate-500')}>📅 个人事项</button>
            <button onClick={() => setCategory('financial')} className={cx('py-2 rounded-xl border text-sm', category === 'financial' ? 'border-violet-300 bg-violet-50 text-violet-600 font-medium' : 'border-slate-200 text-slate-500')}>💰 理财提醒</button>
          </div>
        </Field>
        <Field label="重复">
          <div className="grid grid-cols-3 gap-2">
            {([['once', '只提醒一次'], ['yearly', '每年'], ['monthly', '每月']] as const).map(([v, l]) => <button key={v} onClick={() => setRepeat(v)} className={cx('py-2 rounded-xl border text-sm', repeat === v ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-500')}>{l}</button>)}
          </div>
        </Field>
        <Field label={repeat === 'once' ? '提醒日期' : repeat === 'yearly' ? '每年这天' : '每月这天'}><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="备注（选填）"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="提醒自己注意什么" /></Field>
      </div>
    </Modal>
  )
}

