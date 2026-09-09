import dayjs from 'dayjs'

export const money = (n: number, withSign = false): string => {
  const v = Math.abs(n)
  const s = v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n < 0) return '-' + s
  return withSign ? '+' + s : s
}

export const moneyShort = (n: number): string => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(2)}亿`
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}万`
  return sign + abs.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export const pct = (n: number, digits = 2): string =>
  (n >= 0 ? '+' : '') + n.toFixed(digits) + '%'

export const fmtDate = (d: string | Date) => dayjs(d).format('YYYY-MM-DD')
export const fmtDateCN = (d: string | Date) => dayjs(d).format('YYYY年M月D日')
export const today = () => dayjs().format('YYYY-MM-DD')
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
export const round2 = (n: number) => Math.round(n * 100) / 100
