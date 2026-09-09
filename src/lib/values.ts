import type { AppData, Account, Holding } from '../types'
import { findMeta, priceOf } from './market'

export function holdingsOf(data: AppData, accountId: string): Holding[] {
  return data.holdings.filter((h) => h.accountId === accountId && !(h.shares <= 0))
}

export function holdingMv(h: Holding, date?: Parameters<typeof priceOf>[1]): number {
  return h.shares * priceOf(findMeta(h.symbol), date)
}

export function holdingCost(h: Holding): number {
  return h.shares * h.avgCost
}

/** 账户资产价值（证券 = 可用现金 + 持仓市值；负债不在此） */
export function accountAssetValue(a: Account, data: AppData, date?: Parameters<typeof priceOf>[1]): number {
  if (a.category === 'loan') return 0
  if (a.category === 'securities') {
    const mv = holdingsOf(data, a.id).reduce((s, h) => s + holdingMv(h, date), 0)
    return a.balance + mv
  }
  return a.balance
}

export function totalAssets(data: AppData, date?: Parameters<typeof priceOf>[1]): number {
  return data.accounts.filter((a) => a.category !== 'loan').reduce((s, a) => s + accountAssetValue(a, data, date), 0)
}

export function totalDebt(data: AppData): number {
  return data.accounts.filter((a) => a.category === 'loan').reduce((s, a) => s + a.balance, 0)
}

export function netWorth(data: AppData, date?: Parameters<typeof priceOf>[1]): number {
  return totalAssets(data, date) - totalDebt(data)
}

export interface InvestmentHoldingView extends Holding {
  price: number
  mv: number
  cost: number
  pnl: number
  pnlPct: number
}

export function investmentView(data: AppData, date?: Parameters<typeof priceOf>[1]): InvestmentHoldingView[] {
  return data.holdings.filter((h) => h.shares > 0).map((h) => {
    const meta = findMeta(h.symbol)
    const price = priceOf(meta, date)
    const mv = h.shares * price
    const cost = h.shares * h.avgCost
    return { ...h, price, mv, cost, pnl: mv - cost, pnlPct: cost > 0 ? ((mv - cost) / cost) * 100 : 0 }
  })
}

export function investmentTotals(data: AppData): { cost: number; mv: number; pnl: number; pnlPct: number } {
  const views = investmentView(data)
  const cost = views.reduce((s, v) => s + v.cost, 0)
  const mv = views.reduce((s, v) => s + v.mv, 0)
  return { cost, mv, pnl: mv - cost, pnlPct: cost > 0 ? ((mv - cost) / cost) * 100 : 0 }
}
