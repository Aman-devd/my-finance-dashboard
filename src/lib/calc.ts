// ===== 财务计算工具 =====
import dayjs from 'dayjs'
import type { AppData, Account } from '../types'

/** 单笔复利终值 */
export function futureValueLump(principal: number, annualRatePct: number, years: number): number {
  return principal * Math.pow(1 + annualRatePct / 100, years)
}

/** 定投终值：每月月初投入 monthly，按年化收益复利（月复利近似） */
export function futureValueDCA(monthly: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12
  const n = Math.round(years * 12)
  if (r === 0) return monthly * n
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
}

/** 目标反推：达到 target 需要的每月定投额 */
export function requiredMonthly(target: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12
  const n = Math.round(years * 12)
  if (r === 0) return target / n
  return (target * r) / ((Math.pow(1 + r, n) - 1) * (1 + r))
}

/** 等额本息月供 */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 100 / 12
  if (r === 0) return principal / months
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

export interface LoanSchedule {
  month: number
  payment: number
  interest: number
  principalPart: number
  balance: number
}

export function scheduleOf(principal: number, annualRatePct: number, months: number): LoanSchedule[] {
  const r = annualRatePct / 100 / 12
  const pay = monthlyPayment(principal, annualRatePct, months)
  let bal = principal
  const out: LoanSchedule[] = []
  for (let i = 1; i <= months; i++) {
    const interest = bal * r
    const principalPart = pay - interest
    bal = Math.max(0, bal - principalPart)
    out.push({ month: i, payment: pay, interest, principalPart, balance: bal })
  }
  return out
}

export function totalInterest(principal: number, annualRatePct: number, months: number): number {
  const s = scheduleOf(principal, annualRatePct, months)
  return s.reduce((a, b) => a + b.interest, 0)
}

/** 提前还款省息：remainingMonths 期里提前还 prepay，能省多少利息 */
export function earlyPayoffSaving(principal: number, annualRatePct: number, remainingMonths: number, prepay: number): { savedInterest: number; newRemainingMonths: number; oldInterest: number; newInterest: number } {
  const old = scheduleOf(principal, annualRatePct, remainingMonths)
  const oldInterest = old.reduce((a, b) => a + b.interest, 0)
  const newPrincipal = Math.max(0, principal - prepay)
  const r = annualRatePct / 100 / 12
  // 月供不变，期数缩短
  const pay = monthlyPayment(principal, annualRatePct, remainingMonths)
  let bal = newPrincipal
  let months = 0
  let newInterest = 0
  while (bal > 0 && months < remainingMonths * 2) {
    months++
    const interest = bal * r
    newInterest += interest
    bal -= pay - interest
  }
  return { savedInterest: Math.max(0, oldInterest - newInterest), newRemainingMonths: months, oldInterest, newInterest }
}

// ===== 财务体检 =====
export interface HealthReport {
  liquidTotal: number
  avgMonthlyExpense: number
  emergencyMonths: number
  totalDebt: number
  annualIncome: number
  debtToIncomePct: number
  monthlyDebtPay: number
  score: number
  tips: string[]
}

export function financialHealth(data: AppData): HealthReport {
  const liquid = data.accounts.filter((a) => a.category !== 'loan' && a.category !== 'fund' && a.category !== 'securities')
  const liquidTotal = liquid.reduce((s, a) => s + a.balance, 0)
  const now = dayjs()
  const expenses = data.transactions.filter((t) => t.type === 'expense' && dayjs(t.date).isAfter(now.subtract(3, 'month')))
  const avgMonthlyExpense = expenses.reduce((s, t) => s + t.amount, 0) / 3
  const loans = data.accounts.filter((a) => a.category === 'loan')
  const totalDebt = loans.reduce((s, a) => s + a.balance, 0)
  const monthlyDebtPay = loans.reduce((s, a) => s + (a.loan?.monthlyPayment ?? 0), 0)
  const incomes = data.transactions.filter((t) => t.type === 'income' && dayjs(t.date).isAfter(now.subtract(12, 'month')))
  const annualIncome = incomes.reduce((s, t) => s + t.amount, 0)
  const debtToIncomePct = annualIncome > 0 ? (monthlyDebtPay * 12) / annualIncome * 100 : 0
  const emergencyMonths = avgMonthlyExpense > 0 ? liquidTotal / avgMonthlyExpense : 99
  let score = 100
  const tips: string[] = []
  if (emergencyMonths < 3) { score -= 30; tips.push('应急金建议至少覆盖 3~6 个月开销，目前偏紧') }
  else if (emergencyMonths < 6) { score -= 12; tips.push('应急金建议攒到 6 个月开销更稳妥') }
  else tips.push('应急金充足，很棒')
  if (debtToIncomePct > 40) { score -= 25; tips.push('每月还债占收入比例偏高，注意现金流') }
  else if (debtToIncomePct > 25) { score -= 10; tips.push('负债比例略高，可优先还高息债务') }
  else tips.push('负债水平健康')
  return { liquidTotal, avgMonthlyExpense: Math.round(avgMonthlyExpense), emergencyMonths: Math.round(emergencyMonths * 10) / 10, totalDebt, annualIncome, debtToIncomePct: Math.round(debtToIncomePct * 10) / 10, monthlyDebtPay, score: Math.max(0, score), tips }
}

/** 现金流预测：按近 3 个月平均净现金流线性外推未来 months 个月 */
export function cashflowForecast(data: AppData, months = 6): { month: string; balance: number }[] {
  const now = dayjs()
  const since = now.subtract(3, 'month')
  const flows = data.transactions.filter((t) => dayjs(t.date).isAfter(since))
  let net = 0
  for (const t of flows) net += t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0
  const avgNet = net / 3
  const start = liquidTotal(data)
  const out: { month: string; balance: number }[] = []
  for (let i = 1; i <= months; i++) {
    const m = now.add(i, 'month')
    out.push({ month: m.format('YYYY-MM'), balance: Math.round(start + avgNet * i) })
  }
  return out
}

export function liquidTotal(data: AppData): number {
  return data.accounts.filter((a) => a.category === 'cash' || a.category === 'bank' || a.category === 'alipay' || a.category === 'wechat')
    .reduce((s, a) => s + a.balance, 0)
}

export const ACCOUNT_ORDER: Record<string, number> = { cash: 0, bank: 1, alipay: 2, wechat: 3, securities: 4, fund: 5, loan: 6 }
