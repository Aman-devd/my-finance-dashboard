import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'
import { Solar } from 'lunar-javascript'
import { useApp } from '../lib/store'
import { monthMarks, type HolidayInfo } from '../lib/holidays'
import { nextLunarOccurrence } from '../lib/lunar'
import { Card, Tag, cx } from '../components/ui'
import { ChevronLeft, ChevronRight, Cake, CalendarDays, Bell, HandCoins, Landmark, Sparkles, Plus } from 'lucide-react'

interface DayEvent {
  kind: 'holiday' | 'birthday' | 'anniversary' | 'custom' | 'repay' | 'borrow' | 'event'
  title: string
  sub?: string
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const DOT: Record<string, string> = {
  birthday: '#ec4899', anniversary: '#c026d3', custom: '#2563eb', repay: '#7c3aed', borrow: '#059669', event: '#d97706',
}

function lunarShort(dateStr: string): string {
  try {
    const d = dayjs(dateStr)
    const l = Solar.fromYmd(d.year(), d.month() + 1, d.date()).getLunar()
    return l.getDayInChinese()
  } catch {
    return ''
  }
}

/** 日历主体（供首页弹窗使用） */
export default function CalendarBoard() {
  const { data } = useApp()
  const today = dayjs()
  const [ym, setYm] = useState({ y: today.year(), m: today.month() + 1 })
  const [sel, setSel] = useState<string | null>(null)

  const marks = useMemo(() => monthMarks(ym.y, ym.m), [ym])
  const eventsByDate = useMemo(() => {
    const map = new Map<string, DayEvent[]>()
    const add = (date: string, e: DayEvent) => {
      const arr = map.get(date) || []
      arr.push(e)
      map.set(date, arr)
    }
    const first = dayjs(`${ym.y}-${String(ym.m).padStart(2, '0')}-01`)
    const lastD = first.daysInMonth()
    for (const p of data.people) {
      if (p.calendar === 'solar') {
        if (p.month === ym.m) add(`${ym.y}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`, { kind: 'birthday', title: `${p.name} 生日` })
      } else {
        const d = nextLunarOccurrence(p.month, p.day, first)
        if (d && d.month() + 1 === ym.m && d.year() === ym.y) add(d.format('YYYY-MM-DD'), { kind: 'birthday', title: `${p.name} 生日（农历）` })
      }
    }
    for (const a of data.anniversaries) {
      if (a.month === ym.m) add(`${ym.y}-${String(a.month).padStart(2, '0')}-${String(a.day).padStart(2, '0')}`, { kind: 'anniversary', title: `${a.name}纪念日` })
    }
    for (const c of data.customReminders) {
      const cd = dayjs(c.date)
      if (c.repeat === 'once') {
        if (cd.year() === ym.y && cd.month() + 1 === ym.m) add(cd.format('YYYY-MM-DD'), { kind: 'custom', title: c.title, sub: c.note })
      } else if (c.repeat === 'yearly') {
        if (cd.month() + 1 === ym.m && cd.date() <= lastD) add(`${ym.y}-${String(cd.month() + 1).padStart(2, '0')}-${String(cd.date()).padStart(2, '0')}`, { kind: 'custom', title: c.title, sub: '每年' })
      } else {
        const dd = Math.min(cd.date(), 28)
        if (dd <= lastD) add(`${ym.y}-${String(ym.m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`, { kind: 'custom', title: c.title, sub: '每月' })
      }
    }
    for (const a of data.accounts) {
      if (a.category === 'loan' && a.loan) {
        const dd = Math.min(a.loan.dueDay, lastD)
        add(`${ym.y}-${String(ym.m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`, { kind: 'repay', title: `${a.name}还款`, sub: `¥${a.loan.monthlyPayment.toFixed(0)}` })
      }
    }
    for (const b of data.borrows) {
      if (b.settled || !b.dueDate) continue
      const dd = dayjs(b.dueDate)
      if (dd.year() === ym.y && dd.month() + 1 === ym.m) add(dd.format('YYYY-MM-DD'), { kind: 'borrow', title: `${b.person} ${b.kind === 'lend' ? '还钱' : '还款'}`, sub: `¥${b.amount.toLocaleString()}` })
    }
    for (const e of data.events) {
      const d = dayjs(e.date)
      if (d.year() === ym.y && d.month() + 1 === ym.m) add(d.format('YYYY-MM-DD'), { kind: 'event', title: e.title, sub: e.desc })
    }
    return map
  }, [data, ym])

  const prev = () => setYm((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }))
  const next = () => setYm((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }))
  const goToday = () => { const t = dayjs(); setYm({ y: t.year(), m: t.month() + 1 }); setSel(t.format('YYYY-MM-DD')) }

  const selEvents = sel ? eventsByDate.get(sel) || [] : []
  const selHolidays: HolidayInfo[] = sel ? marks.holidays.filter((h) => h.date === sel) : []

  const iconOf = (k: DayEvent['kind']) => k === 'birthday' ? <Cake size={14} className="text-pink-500" /> : k === 'anniversary' ? <Sparkles size={14} className="text-fuchsia-400" /> : k === 'repay' || k === 'borrow' ? <HandCoins size={14} className="text-violet-500" /> : k === 'custom' ? <Bell size={14} className="text-blue-500" /> : k === 'event' ? <Landmark size={14} className="text-amber-600" /> : <CalendarDays size={14} className="text-red-500" />

  return (
    <div className="space-y-3">
      <Card className="p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <button onClick={prev} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={18} /></button>
            <button onClick={next} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={18} /></button>
          </div>
          <div className="font-bold">{ym.y}年 {ym.m}月</div>
          <button onClick={goToday} className="text-[11px] text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50">回到今天</button>
        </div>

        {/* 周表头：周末列高亮 */}
        <div className="grid grid-cols-7 text-center text-[11px] mb-1">
          {WEEK.map((w, i) => (
            <div key={w} className={cx('py-0.5', i >= 5 ? 'rounded-lg bg-rose-100/80 text-rose-500 font-bold' : 'text-slate-400')}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {marks.cells.map((cell, i) => {
            if (!cell) return <div key={'x' + i} />
            const d = dayjs(cell.date)
            const evs = eventsByDate.get(cell.date) || []
            const isToday = cell.date === today.format('YYYY-MM-DD')
            const isSel = cell.date === sel
            const isWeekendCol = (i % 7) >= 5
            const holiday = cell.holidays[0]
            const dots = [...new Set(evs.map((e) => e.kind))].slice(0, 3)
            const more = evs.length - dots.length
            return (
              <button key={cell.date} onClick={() => setSel(cell.date)} className={cx(
                'min-h-[54px] md:min-h-[62px] rounded-lg p-0.5 flex flex-col items-center transition border',
                isSel ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-transparent',
                !isSel && isWeekendCol ? 'bg-rose-50/70' : '',
                !isSel && !isWeekendCol && 'hover:bg-slate-50',
              )}>
                <span className={cx('text-xs num leading-none', isToday ? 'w-5 h-5 rounded-full bg-blue-600 text-white grid place-items-center font-bold' : holiday ? 'text-red-500 font-semibold' : isWeekendCol ? 'text-red-400 font-medium' : 'text-slate-700')}>{d.date()}</span>
                <span className="text-[8px] text-slate-300 leading-none mt-0.5">{lunarShort(cell.date)}</span>
                {holiday ? (
                  <span className="text-[9px] mt-0.5 px-1 rounded bg-red-500 text-white leading-[14px] truncate max-w-full">{holiday.name.slice(0, 2)}</span>
                ) : evs.length > 0 ? (
                  <span className="flex items-center gap-[2px] mt-1">
                    {dots.map((k, j) => <i key={j} className="w-[5px] h-[5px] rounded-full" style={{ background: DOT[k] }} />)}
                    {more > 0 && <b className="text-[8px] text-slate-400 num leading-none">{`+${more}`}</b>}
                  </span>
                ) : <span className="h-[10px]" />}
              </button>
            )
          })}
        </div>

        {/* 图例 */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><i className="w-[6px] h-[6px] rounded-full" style={{ background: DOT.birthday }} />生日</span>
          <span className="flex items-center gap-1"><i className="w-[6px] h-[6px] rounded-full" style={{ background: DOT.repay }} />还款/借贷</span>
          <span className="flex items-center gap-1"><i className="w-[6px] h-[6px] rounded-full" style={{ background: DOT.custom }} />提醒</span>
          <span className="flex items-center gap-1"><i className="w-[6px] h-[6px] rounded-full" style={{ background: DOT.event }} />财经事件</span>
          <span className="flex items-center gap-1"><i className="w-[6px] h-[6px] rounded-full" style={{ background: DOT.anniversary }} />纪念日</span>
          <span className="text-slate-400">底色=周末</span>
        </div>
      </Card>

      {sel && (
        <Card className="p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-sm font-bold">{dayjs(sel).format('M月D日')} <span className="text-slate-400 font-normal text-xs">周{WEEK[(dayjs(sel).day() + 6) % 7]}</span></div>
            <Link to="/add" className="text-xs text-blue-600 flex items-center gap-0.5"><Plus size={13} /> 记一笔</Link>
          </div>
          {selHolidays.length === 0 && selEvents.length === 0 && <div className="text-xs text-slate-300 py-1.5">这天没有安排</div>}
          <div className="space-y-0.5">
            {selHolidays.map((h) => <div key={h.name + h.date} className="flex items-center gap-2 py-1 text-sm"><span className="text-red-500 font-medium">{h.name}</span><Tag tone={h.kind === 'holiday' ? 'red' : 'amber'}>{h.kind === 'holiday' ? '休' : '节日'}</Tag></div>)}
            {selEvents.map((e, i) => <div key={i} className="flex items-center gap-2.5 py-1 text-sm">{iconOf(e.kind)}<span className="font-medium">{e.title}</span>{e.sub && <span className="text-xs text-slate-400">{e.sub}</span>}</div>)}
          </div>
        </Card>
      )}
    </div>
  )
}
