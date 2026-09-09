import dayjs, { Dayjs } from 'dayjs'
import type { AppData } from '../types'
import { nextBirthday, birthdayLabel, ageAt, zodiacOfYear } from './lunar'

export interface Reminder {
  id: string
  kind: '生日' | '纪念日' | '还款' | '借贷' | '保养' | '车险' | '年检' | '财经事件' | '自定义'
  group: 'financial' | 'personal'
  title: string
  sub: string
  date: Dayjs
  daysLeft: number
  tone: 'primary' | 'warn' | 'info'
}

function yearlyDate(month: number, day: number, now: Dayjs): Dayjs {
  let d = dayjs(`${now.year()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  if (d.isBefore(now, 'day')) d = d.add(1, 'year')
  return d
}

export function upcomingReminders(data: AppData, horizonDays = 45): Reminder[] {
  const out: Reminder[] = []
  const now = dayjs().startOf('day')
  const adv = data.settings.birthdayAdvanceDays || 5

  // 生日（阳历/农历）
  for (const p of data.people) {
    const next = nextBirthday(p, now)
    if (!next) continue
    const diff = next.diff(now, 'day')
    if (diff <= adv) {
      const ageTxt = p.birthYear ? ` · ${ageAt(p.birthYear, next, p.month, p.day)}岁` : ''
      const zodiac = p.birthYear ? zodiacOfYear(p.birthYear) : ''
      out.push({
        id: 'bd-' + p.id, kind: '生日', group: 'personal',
        title: `${p.name} 的生日`,
        sub: `${birthdayLabel(p.calendar, p.month, p.day)}${ageTxt}${zodiac ? ' · 属' + zodiac : ''} · ${p.relation}`,
        date: next, daysLeft: diff, tone: diff === 0 ? 'primary' : 'warn',
      })
    }
  }

  // 纪念日
  for (const a of data.anniversaries) {
    const next = yearlyDate(a.month, a.day, now)
    const diff = next.diff(now, 'day')
    if (diff <= adv) {
      const yearTxt = a.startYear ? ` · 第${next.year() - a.startYear + 1}年` : ''
      out.push({
        id: 'anni-' + a.id, kind: '纪念日', group: 'personal',
        title: `${a.name} 纪念日`,
        sub: `${next.format('M月D日')}${yearTxt}${a.note ? ` · ${a.note}` : ''}`,
        date: next, daysLeft: diff, tone: diff === 0 ? 'primary' : 'warn',
      })
    }
  }

  // 还款（负债）
  const repayAdv = data.settings.repaymentAdvanceDays || 5
  for (const a of data.accounts) {
    if (a.category !== 'loan' || !a.loan) continue
    for (let k = 0; k < 2; k++) {
      const due = dayjs(`${now.year()}-${now.month() + 1 + k}-${String(Math.min(a.loan.dueDay, 28)).padStart(2, '0')}`)
      const diff = due.diff(now, 'day')
      if (diff >= 0 && diff <= repayAdv + 10) {
        out.push({ id: 'loan-' + a.id + '-' + due.format('YYYYMM'), kind: '还款', group: 'financial', title: `${a.name} 还款日`, sub: `月供 ¥${(a.loan.monthlyPayment || 0).toFixed(0)} · 剩余欠款 ¥${a.balance.toFixed(0)}`, date: due, daysLeft: diff, tone: diff <= 3 ? 'primary' : 'warn' })
      }
    }
  }

  // 借出/借入到期
  for (const b of data.borrows) {
    if (b.settled || !b.dueDate) continue
    const due = dayjs(b.dueDate)
    const diff = due.diff(now, 'day')
    if (diff >= 0 && diff <= 15) {
      out.push({ id: 'brw-' + b.id, kind: '借贷', group: 'financial', title: `${b.person} 的${b.kind === 'lend' ? '借款该还了' : '还款日到了'}`, sub: `¥${b.amount.toLocaleString()} · 到期 ${due.format('M月D日')}${b.note ? ` · ${b.note}` : ''}`, date: due, daysLeft: diff, tone: diff <= 3 ? 'primary' : 'warn' })
    }
  }

  // 自定义提醒（一次性 / 每年 / 每月）
  for (const c of data.customReminders) {
    if (c.repeat === 'once') {
      const d = dayjs(c.date)
      const diff = d.diff(now, 'day')
      if (diff >= 0 && diff <= horizonDays) out.push({ id: 'crx-' + c.id, kind: '自定义', group: c.category, title: c.title, sub: `${d.format('YYYY-MM-DD')}${c.note ? ` · ${c.note}` : ''}`, date: d, daysLeft: diff, tone: diff <= 3 ? 'primary' : 'info' })
    } else if (c.repeat === 'yearly') {
      const d = dayjs(c.date)
      const next = yearlyDate(d.month() + 1, d.date(), now)
      const diff = next.diff(now, 'day')
      if (diff <= adv) out.push({ id: 'crx-' + c.id, kind: '自定义', group: c.category, title: c.title, sub: `每年 ${next.format('M月D日')}${c.note ? ` · ${c.note}` : ''}`, date: next, daysLeft: diff, tone: diff === 0 ? 'primary' : 'warn' })
    } else {
      // monthly：每月同一天
      for (let k = 0; k < 2; k++) {
        const dd = Math.min(dayjs(c.date).date(), 28)
        const d = dayjs(`${now.year()}-${now.month() + 1 + k}-${String(dd).padStart(2, '0')}`)
        const diff = d.diff(now, 'day')
        if (diff >= 0 && diff <= adv) out.push({ id: 'crx-' + c.id + '-' + d.format('YYYYMM'), kind: '自定义', group: c.category, title: c.title, sub: `每月 ${dd} 日${c.note ? ` · ${c.note}` : ''}`, date: d, daysLeft: diff, tone: diff === 0 ? 'primary' : 'warn' })
      }
    }
  }

  // 车辆
  const cars = data.cars
  for (const c of cars) {
    if (c.lastServiceDate && c.serviceEveryMonth) {
      const next = dayjs(c.lastServiceDate).add(c.serviceEveryMonth, 'month')
      const diff = next.diff(now, 'day')
      if (diff >= 0 && diff <= 15) out.push({ id: 'svc-t-' + c.id, kind: '保养', group: 'personal', title: `${c.name} 该保养了`, sub: `距上次保养 ${c.serviceEveryMonth} 个月`, date: next, daysLeft: diff, tone: diff <= 3 ? 'primary' : 'info' })
    }
    if (c.lastServiceKm != null && c.serviceEveryKm) {
      const odo = latestOdo(data, c.id)
      const nextKm = c.lastServiceKm + c.serviceEveryKm
      if (odo != null && odo >= nextKm - 300) {
        const est = now.add(Math.max(0, Math.round((nextKm - odo) / 15)), 'day')
        out.push({ id: 'svc-km-' + c.id, kind: '保养', group: 'personal', title: `${c.name} 里程保养提醒`, sub: `建议 ${nextKm.toLocaleString()} km 前保养 · 当前 ${odo.toLocaleString()} km`, date: est, daysLeft: est.diff(now, 'day'), tone: odo >= nextKm ? 'primary' : 'info' })
      }
    }
    if (c.insuranceExpire) {
      const d = dayjs(c.insuranceExpire)
      const diff = d.diff(now, 'day')
      if (diff >= 0 && diff <= 30) out.push({ id: 'ins-' + c.id, kind: '车险', group: 'personal', title: `${c.name} 车险到期`, sub: `到期日 ${d.format('YYYY-MM-DD')}，记得续保`, date: d, daysLeft: diff, tone: diff <= 7 ? 'primary' : 'warn' })
    }
    if (c.inspectionExpire) {
      const d = dayjs(c.inspectionExpire)
      const diff = d.diff(now, 'day')
      if (diff >= 0 && diff <= 30) out.push({ id: 'inspec-' + c.id, kind: '年检', group: 'personal', title: `${c.name} 年检到期`, sub: `到期日 ${d.format('YYYY-MM-DD')}`, date: d, daysLeft: diff, tone: diff <= 7 ? 'primary' : 'warn' })
    }
  }

  // 财经事件
  for (const e of data.events) {
    const d = dayjs(e.date)
    const diff = d.diff(now, 'day')
    if (diff >= 0 && diff <= horizonDays) out.push({ id: 'evt-' + e.id, kind: '财经事件', group: 'financial', title: e.title, sub: e.desc || d.format('YYYY-MM-DD'), date: d, daysLeft: diff, tone: 'info' })
  }

  return out.sort((a, b) => a.date.valueOf() - b.date.valueOf())
}

export function latestOdo(data: AppData, carId: string): number | null {
  const recs = data.fuelRecords.filter((f) => f.carId === carId && f.odometerKm > 0).sort((a, b) => (a.date < b.date ? 1 : -1))
  return recs.length ? recs[0].odometerKm : null
}

