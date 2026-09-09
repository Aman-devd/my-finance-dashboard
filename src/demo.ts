import dayjs from 'dayjs'
import type { AppData, Category } from './types'

// 默认分类
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'c-food', name: '餐饮', type: 'expense', color: '#f97316' },
  { id: 'c-transport', name: '交通', type: 'expense', color: '#0ea5e9' },
  { id: 'c-shopping', name: '购物', type: 'expense', color: '#ec4899' },
  { id: 'c-home', name: '居住', type: 'expense', color: '#8b5cf6' },
  { id: 'c-fun', name: '娱乐', type: 'expense', color: '#a855f7' },
  { id: 'c-medical', name: '医疗', type: 'expense', color: '#ef4444' },
  { id: 'c-edu', name: '教育', type: 'expense', color: '#06b6d4' },
  { id: 'c-social', name: '人情往来', type: 'expense', color: '#f43f5e' },
  { id: 'c-car', name: '汽车', type: 'expense', color: '#64748b' },
  { id: 'c-repay', name: '贷款还款', type: 'expense', color: '#7c3aed' },
  { id: 'c-other-e', name: '其他', type: 'expense', color: '#94a3b8' },
  { id: 'c-salary', name: '工资', type: 'income', color: '#16a34a' },
  { id: 'c-bonus', name: '奖金', type: 'income', color: '#059669' },
  { id: 'c-invest', name: '理财收益', type: 'income', color: '#0d9488' },
  { id: 'c-other-i', name: '其他', type: 'income', color: '#84cc16' },
]

let seq = 0
const sid = () => 'd' + (++seq) + Math.random().toString(36).slice(2, 6)
function rnd(seed: number) {
  let t = (seed + 0x9e3779b9) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function buildDemoData(): AppData {
  seq = 0
  const now = dayjs()
  const ym = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD')

  const accounts = [
    { id: 'acc-bank', name: '工资卡(招行)', category: 'bank' as const, balance: 28600, note: '日常主卡' },
    { id: 'acc-alipay', name: '支付宝', category: 'alipay' as const, balance: 5200 },
    { id: 'acc-wechat', name: '微信', category: 'wechat' as const, balance: 1800 },
    { id: 'acc-cash', name: '现金', category: 'cash' as const, balance: 1200 },
    { id: 'acc-secA', name: '证券A(纳指ETF)', category: 'securities' as const, balance: 8600, note: '长期持有' },
    { id: 'acc-secB', name: '证券B(波段)', category: 'securities' as const, balance: 31000, note: '波段操作' },
    { id: 'acc-fund', name: '公积金', category: 'fund' as const, balance: 98600 },
    { id: 'acc-carLoan', name: '车贷', category: 'loan' as const, balance: 71800, loan: { ratePct: 4.35, monthlyPayment: 4300, dueDay: 15, startDate: '2024-03-10' } },
    { id: 'acc-stuLoan', name: '助学贷款', category: 'loan' as const, balance: 30800, loan: { ratePct: 3.6, monthlyPayment: 1200, dueDay: 20, startDate: '2021-09-01' } },
  ].map((a) => ({ ...a, id: sid(), icon: '', archived: false, cash: undefined }))

  const holdings = [
    { id: sid(), accountId: accounts[4].id, symbol: 'sh513100', name: '纳指100ETF', shares: 60000, avgCost: 1.95 },
    { id: sid(), accountId: accounts[5].id, symbol: 'sh513100', name: '纳指100ETF', shares: 20000, avgCost: 2.24 },
  ]

  const trades = [
    { id: sid(), accountId: accounts[4].id, symbol: 'sh513100', name: '纳指100ETF', side: 'buy' as const, date: '2024-06-18', price: 1.81, shares: 40000, fee: 43 },
    { id: sid(), accountId: accounts[4].id, symbol: 'sh513100', name: '纳指100ETF', side: 'buy' as const, date: '2025-02-14', price: 2.24, shares: 20000, fee: 27 },
    { id: sid(), accountId: accounts[5].id, symbol: 'sh513100', name: '纳指100ETF', side: 'buy' as const, date: '2025-09-10', price: 2.31, shares: 20000, fee: 28 },
  ]

  // 交易流水：最近 80 天
  const transactions: AppData['transactions'] = []
  const expCats = ['c-food', 'c-transport', 'c-shopping', 'c-home', 'c-fun', 'c-medical', 'c-edu', 'c-social']
  const expBase: Record<string, number> = { 'c-food': 42, 'c-transport': 15, 'c-shopping': 180, 'c-home': 400, 'c-fun': 90, 'c-medical': 60, 'c-edu': 120, 'c-social': 300 }
  const cards = [accounts[0].id, accounts[1].id, accounts[2].id]
  const pushTx = (date: dayjs.Dayjs, type: 'income' | 'expense', amount: number, categoryId: string, accountId: string, note?: string) => {
    transactions.push({ id: sid(), date: ym(date), type, amount: Math.round(amount * 100) / 100, categoryId, accountId, note, createdAt: date.valueOf() })
  }
  for (let back = 80; back >= 0; back--) {
    const d = now.subtract(back, 'day')
    // 收入：每月 10 日工资、25 日奖金/理财
    if (d.date() === 10) pushTx(d, 'income', 16000, 'c-salary', accounts[0].id, '月工资')
    if (d.date() === 25 && back < 60) pushTx(d, 'income', 300 + Math.round(rnd(back) * 900), 'c-invest', accounts[0].id, '理财/货基收益')
    // 还款：车贷15日 助学贷20日（本月未来日期不生成）
    if (d.date() === 15 && back > 0) pushTx(d, 'expense', 4300, 'c-repay', accounts[0].id, '车贷还款')
    if (d.date() === 20 && back > 0) pushTx(d, 'expense', 1200, 'c-repay', accounts[0].id, '助学贷款还款')
    // 日常支出（每天 1~3 笔）
    const n = back > 60 ? 2 : 3
    for (let k = 0; k < n; k++) {
      const cat = expCats[Math.floor(rnd(back * 7 + k * 13) * expCats.length)]
      const amount = expBase[cat] * (0.6 + rnd(back * 3 + k) * 1.6)
      pushTx(d, 'expense', amount, cat, cards[Math.floor(rnd(back * 11 + k * 5) * 3)], undefined)
    }
  }
  transactions.sort((a, b) => (a.date < b.date ? -1 : 1))

  const people = [
    { id: sid(), name: '妈妈', relation: '母亲', calendar: 'lunar' as const, month: 8, day: 15, birthYear: 1967, note: '每年生日要回家吃饭' },
    { id: sid(), name: '表妹', relation: '亲戚', calendar: 'solar' as const, month: now.add(6, 'day').month() + 1, day: now.add(6, 'day').date(), birthYear: 1998 },
    { id: sid(), name: '老李', relation: '同事', calendar: 'solar' as const, month: 12, day: 1, birthYear: 1988 },
    { id: sid(), name: '小王', relation: '好友', calendar: 'lunar' as const, month: 1, day: 5, birthYear: 1990, note: '大学室友' },
  ]
  const gifts = [
    { id: sid(), personId: people[0].id, date: now.subtract(20, 'day').format('YYYY-MM-DD'), direction: 'out' as const, occasion: '生日' as const, amount: 800, note: '请吃饭' },
    { id: sid(), personId: people[0].id, date: now.subtract(200, 'day').format('YYYY-MM-DD'), direction: 'out' as const, occasion: '春节' as const, amount: 2000, note: '过年红包' },
    { id: sid(), personId: people[0].id, date: now.subtract(200, 'day').format('YYYY-MM-DD'), direction: 'in' as const, occasion: '春节' as const, amount: 600, note: '妈妈给的红包' },
    { id: sid(), personId: people[2].id, date: now.subtract(300, 'day').format('YYYY-MM-DD'), direction: 'out' as const, occasion: '生日' as const, amount: 500, note: '同事聚餐' },
    { id: sid(), personId: people[3].id, date: now.subtract(60, 'day').format('YYYY-MM-DD'), direction: 'out' as const, occasion: '婚礼' as const, amount: 1000, note: '份子钱' },
  ]

  const cars = [
    { id: sid(), name: '我的车', plate: '沪A·8K888', buyDate: '2022-05-20', serviceEveryKm: 10000, lastServiceKm: 42000, serviceEveryMonth: 6, lastServiceDate: now.subtract(3, 'month').format('YYYY-MM-DD'), insuranceExpire: now.add(20, 'day').format('YYYY-MM-DD'), inspectionExpire: now.add(200, 'day').format('YYYY-MM-DD') },
  ]
  const fuelRecords = [
    { id: sid(), carId: cars[0].id, date: now.subtract(40, 'day').format('YYYY-MM-DD'), kind: '加油' as const, odometerKm: 49800, liters: 42, amount: 340 },
    { id: sid(), carId: cars[0].id, date: now.subtract(18, 'day').format('YYYY-MM-DD'), kind: '加油' as const, odometerKm: 50500, liters: 40, amount: 328 },
    { id: sid(), carId: cars[0].id, date: now.subtract(2, 'day').format('YYYY-MM-DD'), kind: '加油' as const, odometerKm: 51200, liters: 44, amount: 356 },
  ]
  const carExpenses = [
    { id: sid(), carId: cars[0].id, date: now.subtract(10, 'day').format('YYYY-MM-DD'), kind: '停车' as const, amount: 300, note: '公司月卡' },
    { id: sid(), carId: cars[0].id, date: now.subtract(25, 'day').format('YYYY-MM-DD'), kind: '过路费' as const, amount: 120, note: '周末高速' },
    { id: sid(), carId: cars[0].id, date: now.subtract(120, 'day').format('YYYY-MM-DD'), kind: '保养' as const, amount: 980, odometerKm: 42000, note: '小保养' },
  ]

  const goals = [
    { id: sid(), name: '日本旅行基金', targetAmount: 30000, savedAmount: 12000, monthly: 2000, deadline: now.add(9, 'month').format('YYYY-MM-DD'), color: '#0ea5e9' },
    { id: sid(), name: '换车基金', targetAmount: 200000, savedAmount: 60000, monthly: 4000, deadline: now.add(30, 'month').format('YYYY-MM-DD'), color: '#8b5cf6' },
  ]

  const events = [
    { id: sid(), date: now.add(4, 'day').format('YYYY-MM-DD'), title: '美国 CPI 数据公布', desc: '关注通胀对纳指影响' },
    { id: sid(), date: now.add(11, 'day').format('YYYY-MM-DD'), title: '美联储议息会议', desc: '利率决议 + 鲍威尔发布会' },
    { id: sid(), date: now.add(26, 'day').format('YYYY-MM-DD'), title: '美国非农就业数据', desc: '每月首个周五' },
  ]


  const anniversaries = [
    { id: sid(), name: '结婚纪念日', month: 10, day: 1, startYear: 2018, note: '顺便安排出游' },
    { id: sid(), name: '恋爱纪念日', month: 3, day: 15, startYear: 2015 },
  ]
  const customReminders = [
    { id: sid(), title: '信用卡出账日', date: now.add(7, 'day').format('YYYY-MM-DD'), repeat: 'monthly' as const, category: 'financial' as const, note: '每月 12 日' },
    { id: sid(), title: '给爸妈买体检套餐', date: now.add(12, 'day').format('YYYY-MM-DD'), repeat: 'yearly' as const, category: 'personal' as const },
  ]
  const borrows = [
    { id: sid(), kind: 'lend' as const, person: '同事小刘', amount: 2000, date: now.subtract(20, 'day').format('YYYY-MM-DD'), dueDate: now.add(10, 'day').format('YYYY-MM-DD'), note: '吃饭垫付', settled: false },
    { id: sid(), kind: 'borrow' as const, person: '大学室友阿伟', amount: 1500, date: now.subtract(90, 'day').format('YYYY-MM-DD'), dueDate: now.add(15, 'day').format('YYYY-MM-DD'), note: '借去买相机', settled: false },
    { id: sid(), kind: 'lend' as const, person: '表哥', amount: 3000, date: now.subtract(200, 'day').format('YYYY-MM-DD'), note: '已还清', settled: true, settledDate: now.subtract(150, 'day').format('YYYY-MM-DD') },
  ]
  const settings = { birthdayAdvanceDays: 5, repaymentAdvanceDays: 5, monthlyBudget: 8000, categoryBudgets: { 'c-food': 2000, 'c-shopping': 1500, 'c-fun': 800 } }

  return {
    version: 2,
    accounts: accounts as AppData['accounts'],
    transactions,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    holdings,
    trades,
    people,
    gifts,
    cars: cars as AppData['cars'],
    fuelRecords,
    carExpenses,
    goals,
    events,
    anniversaries,
    customReminders,
    borrows,
    settings,
  }
}


