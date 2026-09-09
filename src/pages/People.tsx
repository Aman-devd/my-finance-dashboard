import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { Button, Card, Empty, Field, Modal, PageHead, Select, Tag, TextInput, cx } from '../components/ui'
import { Plus, Pencil, Trash2, Gift as GiftIcon, Cake, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { nextBirthday, birthdayLabel, ageAt, zodiacOfYear } from '../lib/lunar'
import type { AppData, Gift, Occasion, Person } from '../types'


function nextAnniversary(month: number, day: number, from = dayjs()): dayjs.Dayjs {
  let d = dayjs(`${from.year()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  if (d.isBefore(from, 'day')) d = d.add(1, 'year')
  return d
}
const OCCASIONS: Occasion[] = ['生日', '春节', '中秋', '端午', '婚礼', '满月', '乔迁', '探病', '其他']
const SUGGEST: Record<Occasion, number> = { 生日: 600, 春节: 1000, 中秋: 600, 端午: 400, 婚礼: 1000, 满月: 800, 乔迁: 800, 探病: 500, 其他: 300 }

export default function People() {
  const { data, addPerson, updatePerson, deletePerson, addGift, deleteGift, addAnniversary, updateAnniversary, deleteAnniversary } = useApp()
  const [personForm, setPersonForm] = useState<{ open: boolean; person?: Person }>({ open: false })
  const [detail, setDetail] = useState<Person | null>(null)
  const [giftFor, setGiftFor] = useState<Person | null>(null)
  const [anniForm, setAnniForm] = useState<{ open: boolean; item?: AppData['anniversaries'][number] }>({ open: false })

  const g = data.gifts
  const yearOut = g.filter((x) => x.direction === 'out' && x.date.startsWith(dayjs().format('YYYY'))).reduce((a, x) => a + x.amount, 0)
  const yearIn = g.filter((x) => x.direction === 'in' && x.date.startsWith(dayjs().format('YYYY'))).reduce((a, x) => a + x.amount, 0)
  const giftOf = (pid: string) => g.filter((x) => x.personId === pid)
  const outOf = (pid: string) => giftOf(pid).filter((x) => x.direction === 'out')
  const inOf = (pid: string) => giftOf(pid).filter((x) => x.direction === 'in')

  const rows = useMemo(() => [...data.people].sort((a, b) => {
    const da = nextBirthday(a)?.valueOf() ?? Infinity
    const db = nextBirthday(b)?.valueOf() ?? Infinity
    return da - db
  }), [data.people])

  const personsById = (id?: string) => data.people.find((p) => p.id === id)

  return (
    <div>
      <PageHead title="人情往来" sub="生日提醒 · 随礼台账" right={<Button onClick={() => setPersonForm({ open: true })}><Plus size={16} /> 添加亲友</Button>} />

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Card className="p-3 text-center"><div className="text-[11px] text-slate-400">今年随出</div><div className="text-red-500 font-bold num mt-0.5">¥{yearOut.toLocaleString()}</div></Card>
        <Card className="p-3 text-center"><div className="text-[11px] text-slate-400">今年收到</div><div className="text-emerald-600 font-bold num mt-0.5">¥{yearIn.toLocaleString()}</div></Card>
        <Card className="p-3 text-center"><div className="text-[11px] text-slate-400">往来净额</div><div className="text-slate-800 font-bold num mt-0.5">¥{(yearIn - yearOut).toLocaleString()}</div></Card>
      </div>

      {rows.length === 0 && <Card><Empty text="还没有添加亲友，先录入生日和随礼吧" /></Card>}

      <div className="space-y-2.5">
        {rows.map((p) => {
          const next = nextBirthday(p)
          const diff = next ? next.diff(dayjs().startOf('day'), 'day') : null
          const outs = outOf(p.id).reduce((a, x) => a + x.amount, 0)
          const ins = inOf(p.id).reduce((a, x) => a + x.amount, 0)
          const giftCount = giftOf(p.id).length
          return (
            <Card key={p.id} className="p-4 flex items-center gap-3" >
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 text-white grid place-items-center font-bold shrink-0">{p.name.slice(0, 1)}</span>
              <button className="flex-1 min-w-0 text-left" onClick={() => setDetail(p)}>
                <div className="text-sm font-semibold flex items-center gap-1.5">{p.name} <span className="text-[11px] font-normal text-slate-400">{p.relation}</span></div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {p.calendar === 'lunar' ? '农历' : '阳历'}{birthdayLabel(p.calendar, p.month, p.day)}
                  {p.birthYear ? ` · 属${zodiacOfYear(p.birthYear)}` : ''}
                  {diff !== null && diff >= 0 && diff <= 90 ? <Tag tone={diff <= 5 ? 'red' : 'amber'}>{diff === 0 ? '今天生日' : `还有${diff}天`}</Tag> : null}
                </div>
              </button>
              <div className="text-right text-[11px] text-slate-400 leading-4">
                <div>随出 <b className="text-red-500 num">¥{outs.toLocaleString()}</b></div>
                <div>收到 <b className="text-emerald-600 num">¥{ins.toLocaleString()}</b></div>
                <div>{giftCount} 笔记录</div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setGiftFor(p)} className="text-[11px] text-pink-600 flex items-center gap-0.5"><GiftIcon size={11} /> 记礼</button>
                <button onClick={() => setPersonForm({ open: true, person: p })} className="text-[11px] text-slate-400"><Pencil size={11} /></button>
                <button onClick={() => { if (window.confirm(`删除 ${p.name}？其随礼记录也会删除`)) deletePerson(p.id) }} className="text-[11px] text-red-400"><Trash2 size={11} /></button>
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="p-4 mt-4" style={{ background: 'linear-gradient(135deg, #fffbeb, #fff7ed)' }}>
        <div className="text-sm font-semibold flex items-center gap-1.5"><Cake size={16} className="text-pink-500" /> 近期生日</div>
        <div className="mt-2 space-y-1.5">
          {rows.filter((p) => { const n = nextBirthday(p); return n && n.diff(dayjs().startOf('day'), 'day') <= 15 }).length === 0 && <div className="text-xs text-slate-400">15 天内没有生日</div>}
          {rows.filter((p) => { const n = nextBirthday(p); return n && n.diff(dayjs().startOf('day'), 'day') <= 15 }).map((p) => {
            const n = nextBirthday(p)!
            const diff = n.diff(dayjs().startOf('day'), 'day')
            return (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{p.name} · {n.format('M月D日')}{p.birthYear ? `（${ageAt(p.birthYear, n, p.month, p.day)}岁）` : ''}</span>
                <Tag tone={diff === 0 ? 'red' : diff <= 5 ? 'amber' : 'blue'}>{diff === 0 ? '就是今天' : `${diff} 天后`}</Tag>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 纪念日 */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold flex items-center gap-1.5">💞 纪念日（快到了会提醒）</div>
          <Button variant="ghost" className="!px-2" onClick={() => setAnniForm({ open: true })}><Plus size={15} /> 添加</Button>
        </div>
        {data.anniversaries.length === 0 && <div className="text-xs text-slate-300 py-2">还没有纪念日，比如结婚纪念日、恋爱纪念日</div>}
        <div className="divide-y divide-slate-50">
          {[...data.anniversaries].sort((a, b) => nextAnniversary(a.month, a.day).valueOf() - nextAnniversary(b.month, b.day).valueOf()).map((a) => {
            const n = nextAnniversary(a.month, a.day)
            const diff = n.diff(dayjs().startOf('day'), 'day')
            return (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="w-8 h-8 rounded-full bg-pink-50 text-pink-500 grid place-items-center">💞</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{a.name}{a.startYear ? <span className="text-[11px] font-normal text-slate-400"> · 第{n.year() - a.startYear + 1}年</span> : null}</div>
                  <div className="text-[11px] text-slate-400">{n.format('每年M月D日')}{a.note ? ` · ${a.note}` : ''}</div>
                </div>
                <Tag tone={diff === 0 ? 'red' : diff <= 5 ? 'amber' : diff <= 15 ? 'blue' : 'slate'}>{diff === 0 ? '今天' : diff <= 15 ? `${diff} 天后` : n.format('M月D日')}</Tag>
                <button onClick={() => setAnniForm({ open: true, item: a })} className="text-slate-400"><Pencil size={13} /></button>
                <button onClick={() => deleteAnniversary(a.id)} className="text-red-400"><Trash2 size={13} /></button>
              </div>
            )
          })}
        </div>
      </Card>
      {personForm.open && <PersonForm person={personForm.person} onClose={() => setPersonForm({ open: false })} onSave={(p) => { if (personForm.person) updatePerson(personForm.person.id, p); else addPerson(p); setPersonForm({ open: false }) }} />}
      {anniForm.open && <AnnivForm item={anniForm.item} onClose={() => setAnniForm({ open: false })} onSave={(a) => { if (anniForm.item) updateAnniversary(anniForm.item.id, a); else addAnniversary(a); setAnniForm({ open: false }) }} />}
      {detail && <DetailModal person={detail} giftOf={giftOf} onClose={() => setDetail(null)} onAddGift={() => { setGiftFor(detail); setDetail(null) }} onDeleteGift={deleteGift} personsById={personsById} />}
      {giftFor && <GiftForm person={giftFor} onClose={() => setGiftFor(null)} onSave={(gf) => { addGift(gf); setGiftFor(null) }} />}
    </div>
  )
}

function PersonForm({ person, onClose, onSave }: { person?: Person; onClose: () => void; onSave: (p: Omit<Person, 'id'>) => void }) {
  const [name, setName] = useState(person?.name || '')
  const [relation, setRelation] = useState(person?.relation || '朋友')
  const [calendar, setCalendar] = useState<'solar' | 'lunar'>(person?.calendar || 'solar')
  const [month, setMonth] = useState(person ? String(person.month) : '')
  const [day, setDay] = useState(person ? String(person.day) : '')
  const [birthYear, setBirthYear] = useState(person?.birthYear ? String(person.birthYear) : '')
  const [note, setNote] = useState(person?.note || '')
  const m = parseInt(month) || 0, d = parseInt(day) || 0
  const ok = name.trim() && m >= 1 && m <= 12 && d >= 1 && d <= 31
  return (
    <Modal open title={person ? '编辑亲友' : '添加亲友'} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!ok} onClick={() => onSave({ name: name.trim(), relation: relation.trim() || '朋友', calendar, month: m, day: d, birthYear: birthYear ? parseInt(birthYear) : undefined, note: note || undefined })}>保存</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="姓名"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="关系"><TextInput value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="父母/朋友/同事" /></Field>
        </div>
        <Field label="过阳历还是农历">
          <div className="flex gap-2">
            {(['solar', 'lunar'] as const).map((c) => <button key={c} onClick={() => setCalendar(c)} className={cx('flex-1 py-2 rounded-xl border text-sm', calendar === c ? 'border-pink-400 bg-pink-50 text-pink-600 font-medium' : 'border-slate-200 text-slate-500')}>{c === 'solar' ? '阳历生日' : '农历生日'}</button>)}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="月"><TextInput inputMode="numeric" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
          <Field label="日"><TextInput inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        </div>
        <Field label="出生年份（选填，用于显示年龄/生肖）"><TextInput inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="如 1990" /></Field>
        <Field label="备注"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：爱吃辣 / 送过围巾" /></Field>
      </div>
    </Modal>
  )
}

function GiftForm({ person, onClose, onSave }: { person: Person; onClose: () => void; onSave: (g: Omit<Gift, 'id'>) => void }) {
  const [direction, setDirection] = useState<'out' | 'in'>('out')
  const [occasion, setOccasion] = useState<Occasion>('生日')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [note, setNote] = useState('')
  const amt = parseFloat(amount) || 0
  const suggest = SUGGEST[occasion]
  return (
    <Modal open title={`给 ${person.name} 记一笔`} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={amt <= 0} onClick={() => onSave({ personId: person.id, direction, occasion, amount: Math.round(amt * 100) / 100, date, note: note || undefined })}>保存</Button></>}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {([['out', '我随出'], ['in', '我收到']] as const).map(([v, l]) => <button key={v} onClick={() => setDirection(v)} className={cx('flex-1 py-2 rounded-xl border text-sm', direction === v ? (v === 'out' ? 'border-red-300 bg-red-50 text-red-600 font-medium' : 'border-emerald-300 bg-emerald-50 text-emerald-600 font-medium') : 'border-slate-200 text-slate-500')}>{l}</button>)}
        </div>
        <Field label="场合">
          <div className="flex flex-wrap gap-1.5">
            {OCCASIONS.map((o) => <button key={o} onClick={() => setOccasion(o)} className={cx('px-2.5 py-1 rounded-lg text-xs border', occasion === o ? 'border-pink-400 bg-pink-50 text-pink-600' : 'border-slate-200 text-slate-500')}>{o}</button>)}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="金额" hint={direction === 'out' ? `参考 ${suggest} 元` : undefined}><TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="日期"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="备注"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：生日红包 / 满月酒" /></Field>
      </div>
    </Modal>
  )
}

function DetailModal({ person, giftOf, onClose, onAddGift, onDeleteGift, personsById }: {
  person: Person
  giftOf: (pid: string) => Gift[]
  onClose: () => void
  onAddGift: () => void
  onDeleteGift: (id: string) => void
  personsById: (id?: string) => Person | undefined
}) {
  const gifts = giftOf(person.id).sort((a, b) => (a.date < b.date ? 1 : -1))
  const outSum = gifts.filter((x) => x.direction === 'out').reduce((a, x) => a + x.amount, 0)
  const inSum = gifts.filter((x) => x.direction === 'in').reduce((a, x) => a + x.amount, 0)
  const n = nextBirthday(person)
  return (
    <Modal open title={`${person.name} 的往来`} onClose={onClose} footer={<Button onClick={onAddGift}><GiftIcon size={15} /> 记一笔</Button>}>
      <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-3 text-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">{person.relation} · {person.calendar === 'lunar' ? '农历' : '阳历'}{birthdayLabel(person.calendar, person.month, person.day)}</div>
            {n && <div className="font-semibold mt-0.5">下次生日：{n.format('YYYY年M月D日')}{person.birthYear ? `（${ageAt(person.birthYear, n, person.month, person.day)}岁 · 属${zodiacOfYear(person.birthYear)}）` : ''}</div>}
          </div>
          <div className="text-right text-xs">
            <div>随出 <b className="text-red-500">¥{outSum}</b></div>
            <div>收到 <b className="text-emerald-600">¥{inSum}</b></div>
          </div>
        </div>
        {gifts.length === 0 && <div className="text-xs text-slate-400 text-center py-4">暂无随礼记录</div>}
        <div className="divide-y divide-slate-50 max-h-72 overflow-auto">
          {gifts.map((x) => (
            <div key={x.id} className="flex items-center gap-3 py-2.5">
              <span className={cx('w-8 h-8 rounded-full grid place-items-center', x.direction === 'out' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600')}>{x.direction === 'out' ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm">{x.occasion}{x.note ? ` · ${x.note}` : ''}</div>
                <div className="text-[11px] text-slate-400">{x.date}</div>
              </div>
              <div className={cx('num font-semibold', x.direction === 'out' ? 'text-red-500' : 'text-emerald-600')}>{x.direction === 'out' ? '-' : '+'}¥{x.amount}</div>
              <button onClick={() => onDeleteGift(x.id)} className="text-slate-300 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        {outSum > 0 && <div className="text-[11px] text-slate-400">累计随出 ¥{outSum} · 对方收到{inSum ? ` ¥${inSum}` : ''}（参考：下次可随 ¥{Math.round(outSum / gifts.filter((x) => x.direction === 'out').length / 100) * 100} 左右）</div>}
      </div>
    </Modal>
  )
}

function AnnivForm({ item, onClose, onSave }: { item?: AppData['anniversaries'][number]; onClose: () => void; onSave: (a: Omit<AppData['anniversaries'][number], 'id'>) => void }) {
  const [name, setName] = useState(item?.name || '')
  const [month, setMonth] = useState(item ? String(item.month) : '')
  const [day, setDay] = useState(item ? String(item.day) : '')
  const [startYear, setStartYear] = useState(item?.startYear ? String(item.startYear) : '')
  const [note, setNote] = useState(item?.note || '')
  const m = parseInt(month) || 0, d = parseInt(day) || 0
  const ok = name.trim() && m >= 1 && m <= 12 && d >= 1 && d <= 31
  return (
    <Modal open title={item ? '编辑纪念日' : '添加纪念日'} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!ok} onClick={() => onSave({ name: name.trim(), month: m, day: d, startYear: startYear ? parseInt(startYear) : undefined, note: note || undefined })}>保存</Button></>}>
      <div className="space-y-3">
        <Field label="名称"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="如：结婚纪念日" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="月"><TextInput inputMode="numeric" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
          <Field label="日"><TextInput inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
          <Field label="起始年份（选填）"><TextInput inputMode="numeric" value={startYear} onChange={(e) => setStartYear(e.target.value)} placeholder="2018" /></Field>
        </div>
        <Field label="备注"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="选填" /></Field>
      </div>
    </Modal>
  )
}


