// ===== 核心类型定义 =====

export type AccountCategory =
  | 'cash' | 'bank' | 'alipay' | 'wechat'   // 现金类
  | 'securities'                            // 证券账户
  | 'fund'                                  // 公积金
  | 'loan';                                 // 负债（车贷/助学贷款/其他）

export interface Account {
  id: string;
  name: string;
  category: AccountCategory;
  /** 资产账户: 当前余额; 公积金: 当前余额; 负债账户: 剩余欠款(正数) */
  balance: number;
  /** 证券账户可用现金 */
  cash?: number;
  /** 负债专属 */
  loan?: {
    ratePct: number;          // 年利率 %
    monthlyPayment: number;   // 每月还款额
    dueDay: number;           // 每月还款日(1-28)
    startDate: string;        // 首次放款/开始日期
  };
  note?: string;
  icon?: string;
  archived?: boolean;
}

export type TxType = 'income' | 'expense' | 'transfer' | 'repay';

export interface Transaction {
  id: string;
  date: string;               // YYYY-MM-DD
  type: TxType;
  amount: number;             // 正数
  accountId: string;          // 支出/收入/还款对应的主账户
  toAccountId?: string;       // 转账目标 / 还款目标(负债账户)
  categoryId?: string;
  note?: string;
  createdAt: number;
}

export type CategoryType = 'income' | 'expense';
export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon?: string;
}

export interface Holding {
  id: string;
  accountId: string;          // 证券账户
  symbol: string;             // 如 sh513100
  name: string;
  shares: number;
  avgCost: number;            // 平均成本价
  note?: string;
}

export type TradeSide = 'buy' | 'sell';
export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  side: TradeSide;
  date: string;
  price: number;
  shares: number;
  fee?: number;
  note?: string;
}

export interface Person {
  id: string;
  name: string;
  relation: string;          // 父母/朋友/同事...
  calendar: 'solar' | 'lunar';
  month: number;
  day: number;
  birthYear?: number;  // 出生年份(可选，用于算年龄/生肖)
  note?: string;
}

export type GiftDirection = 'out' | 'in';
export type Occasion = '生日' | '春节' | '中秋' | '端午' | '婚礼' | '满月' | '乔迁' | '探病' | '其他';
export interface Gift {
  id: string;
  personId: string;
  date: string;
  direction: GiftDirection;
  occasion: Occasion;
  amount: number;
  note?: string;
}

export interface Car {
  id: string;
  name: string;
  photo?: string; // 车辆小照片(dataURL)
  plate?: string;
  buyDate?: string;
  /** 保养：按里程(公里) */
  serviceEveryKm?: number;
  lastServiceKm?: number;
  /** 保养：按时间(月) */
  serviceEveryMonth?: number;
  lastServiceDate?: string;
  /** 车险到期日 */
  insuranceExpire?: string;
  /** 年检到期日 */
  inspectionExpire?: string;
  note?: string;
}

export type FuelKind = '加油' | '充电';
export interface FuelRecord {
  id: string;
  carId: string;
  date: string;
  kind: FuelKind;
  odometerKm: number;
  liters?: number;
  amount: number;
  note?: string;
}

export type CarExpenseKind = '保险' | '保养' | '停车' | '过路费' | '罚款' | '洗车' | '维修' | '其他';
export interface CarExpense {
  id: string;
  carId: string;
  date: string;
  kind: CarExpenseKind;
  amount: number;
  odometerKm?: number;
  note?: string;
}


export interface Anniversary {
  id: string;
  name: string;          // 如：结婚纪念日
  month: number;
  day: number;
  startYear?: number;    // 起始年份，用于显示"第N年"
  note?: string;
}

export interface CustomReminder {
  id: string;
  title: string;
  date: string;          // once：具体日期；yearly：每年该月日
  repeat: 'once' | 'yearly' | 'monthly';
  category: 'financial' | 'personal';
  note?: string;
}

export type BorrowKind = 'lend' | 'borrow';  // lend=借出(别人欠我) borrow=借入(我欠别人)
export interface Borrow {
  id: string;
  kind: BorrowKind;
  person: string;
  amount: number;
  date: string;
  dueDate?: string;
  note?: string;
  settled: boolean;
  settledDate?: string;
}
export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  monthly?: number;          // 每月计划存入
  deadline?: string;
  color?: string;
}

export interface FinancialEvent {
  id: string;
  date: string;
  title: string;
  desc?: string;
}

export interface AppData {
  version: number;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  holdings: Holding[];
  trades: Trade[];
  people: Person[];
  gifts: Gift[];
  cars: Car[];
  fuelRecords: FuelRecord[];
  carExpenses: CarExpense[];
  goals: Goal[];
  events: FinancialEvent[];   // 财经事件
  anniversaries: Anniversary[];
  customReminders: CustomReminder[];
  borrows: Borrow[];
  settings: {
    birthdayAdvanceDays: number;
    repaymentAdvanceDays: number;
    monthlyBudget: number;
    categoryBudgets: Record<string, number>;
    investStartDate?: string; // 投资记录起始日（收益累计从这天开始）
  };
}






