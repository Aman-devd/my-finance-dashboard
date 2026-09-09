import dayjs, { Dayjs } from 'dayjs'
import { Lunar } from 'lunar-javascript'

/** 农历月/日的中文名，如 八月初五 */
export function lunarText(month: number, day: number, year = dayjs().year()): string {
  try {
    const l = Lunar.fromYmd(year, month, day)
    return l.getMonthInChinese() + l.getDayInChinese()
  } catch {
    return `农历${month}月${day}日`
  }
}

function trySolar(year: number, month: number, day: number): Dayjs | null {
  try {
    const s = Lunar.fromYmd(year, month, day).getSolar()
    return dayjs(`${s.getYear()}-${String(s.getMonth()).padStart(2, '0')}-${String(s.getDay()).padStart(2, '0')}`)
  } catch {
    return null
  }
}

/** 计算某个阴历生日(month/day)在 from 之后的最近一次阳历日期 */
export function nextLunarOccurrence(month: number, day: number, from = dayjs()): Dayjs | null {
  for (let y = from.year(); y <= from.year() + 3; y++) {
    const s = trySolar(y, month, day)
    if (s && (s.isAfter(from) || s.isSame(from, 'day'))) return s
  }
  return null
}

export interface BirthdayInfo {
  label: string        // 阳历 9月5日 / 农历八月初五
  next: Dayjs | null
}

export function birthdayLabel(calendar: 'solar' | 'lunar', month: number, day: number): string {
  return calendar === 'lunar' ? lunarText(month, day) : `${month}月${day}日`
}

/** 农历生日在 from 之后的最近一次阳历日期 */
export function nextBirthday(p: { calendar: 'solar' | 'lunar'; month: number; day: number }, from = dayjs()): Dayjs | null {
  if (p.calendar === 'solar') {
    let d = dayjs(`${from.year()}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`)
    if (d.isBefore(from, 'day')) d = d.add(1, 'year')
    return d
  }
  return nextLunarOccurrence(p.month, p.day, from)
}

const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
/** 出生年份 → 生肖（按农历年近似：1月1日-春节前出生按前一年，此处用公历年份近似，供参考） */
export function zodiacOfYear(year: number): string {
  return ZODIACS[((year - 4) % 12 + 12) % 12]
}

/** 农历年份的生肖（更准确，用于农历生日人员） */
export function lunarZodiac(year: number, month: number, day: number): string {
  try {
    return Lunar.fromYmd(year, month, day).getYearShengXiao()
  } catch {
    return zodiacOfYear(year)
  }
}

/** 计算周岁：到 next 生日时的年龄 */
export function ageAt(birthYear: number, next: Dayjs, birthMonth: number, birthDay: number): number {
  return next.year() - birthYear
}
