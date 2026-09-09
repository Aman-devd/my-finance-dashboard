import dayjs, { Dayjs } from 'dayjs'
import { Lunar } from 'lunar-javascript'

export interface HolidayInfo {
  date: string
  name: string
  kind: 'holiday' | 'festival' // holiday=法定/传统假日  festival=其他传统节日(非假)
}

function solarOf(year: number, lunarMonth: number, lunarDay: number): Dayjs | null {
  try {
    const s = Lunar.fromYmd(year, lunarMonth, lunarDay).getSolar()
    return dayjs(`${s.getYear()}-${String(s.getMonth()).padStart(2, '0')}-${String(s.getDay()).padStart(2, '0')}`)
  } catch {
    return null
  }
}

/** 返回某一年主要节假日（含农历换算），日期为当年实际阳历 */
export function holidaysOfYear(year: number): HolidayInfo[] {
  const out: HolidayInfo[] = []
  const push = (m: number, d: number, name: string, kind: HolidayInfo['kind']) => {
    const dt = dayjs(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    out.push({ date: dt.format('YYYY-MM-DD'), name, kind })
  }
  // 法定假日（固定日期）
  push(1, 1, '元旦', 'holiday')
  push(5, 1, '劳动节', 'holiday')
  push(10, 1, '国庆节', 'holiday')
  // 清明（约 4/4-4/6，演示按 4/4）
  push(4, 4, '清明节', 'holiday')
  // 农历传统
  const lunarFests: [number, number, string, HolidayInfo['kind']][] = [
    [1, 1, '春节', 'holiday'],
    [1, 15, '元宵节', 'festival'],
    [5, 5, '端午节', 'holiday'],
    [7, 7, '七夕', 'festival'],
    [8, 15, '中秋节', 'holiday'],
    [9, 9, '重阳节', 'festival'],
  ]
  for (const [lm, ld, name, kind] of lunarFests) {
    const d = solarOf(year, lm, ld)
    if (d) out.push({ date: d.format('YYYY-MM-DD'), name, kind })
  }
  // 春节假期前后几天（初一前后按初一所在周边，简化为初一~初三）
  const spring = solarOf(year, 1, 1)
  if (spring) {
    for (let k = 1; k <= 2; k++) {
      const d = spring.add(k, 'day')
      out.push({ date: d.format('YYYY-MM-DD'), name: '春节假期', kind: 'holiday' })
    }
  }
  const national = dayjs(`${year}-10-01`)
  for (let k = 1; k <= 2; k++) out.push({ date: national.add(k, 'day').format('YYYY-MM-DD'), name: '国庆假期', kind: 'holiday' })
  return out
}

export interface CalendarDayMark {
  date: string
  holidays: HolidayInfo[]
  weekend: boolean
}

/** 某月所有日子的节假日/周末标记（周起始周一） */
export function monthMarks(year: number, month: number): { cells: (CalendarDayMark | null)[]; holidays: HolidayInfo[] } {
  const first = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
  const daysInMonth = first.daysInMonth()
  const lead = (first.day() + 6) % 7 // 周一为 0
  const holidays = holidaysOfYear(year)
  const hMap = new Map<string, HolidayInfo[]>()
  for (const h of holidays) {
    const arr = hMap.get(h.date) || []
    arr.push(h)
    hMap.set(h.date, arr)
  }
  const cells: (CalendarDayMark | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    const dow = date.day()
    cells.push({ date: date.format('YYYY-MM-DD'), holidays: hMap.get(date.format('YYYY-MM-DD')) || [], weekend: dow === 0 || dow === 6 })
  }
  return { cells, holidays }
}
