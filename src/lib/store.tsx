import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { AppData, Account, Transaction, Category, Holding, Trade, Person, Gift, Car, FuelRecord, CarExpense, Goal, FinancialEvent, Anniversary, CustomReminder, Borrow } from '../types'
import { buildDemoData, DEFAULT_CATEGORIES } from '../demo'
import { uid } from './format'
import { supabase, cloudReady, getCloudUser } from './cloud'
import dayjs from 'dayjs'


// 稳定序列化：递归排序对象键，避免键顺序差异导致误判
function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) => {
    if (Array.isArray(val)) return val.map((x) => stableSort(x))
    if (val && typeof val === 'object') return stableSort(val)
    return val
  })
}
function stableSort(o: unknown): unknown {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(o as Record<string, unknown>).sort()) out[k] = (o as Record<string, unknown>)[k]
  return out
}
const LS_KEY = 'finance.app.data.v1'
const DIRTY_KEY = 'finance.app.dirty.v1'
function readDirty(): boolean { try { return localStorage.getItem(DIRTY_KEY) === '1' } catch { return false } }
function writeDirty(v: boolean) { try { if (v) localStorage.setItem(DIRTY_KEY, '1'); else localStorage.removeItem(DIRTY_KEY) } catch { /* ignore */ } }

export interface BackupItem { at: number; reason: string; data: AppData }
const HIST_KEY = 'finance.app.history.v1'
const HIST_MAX = 12
function readHist(): BackupItem[] { try { const r = localStorage.getItem(HIST_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a.filter((x: BackupItem) => x && typeof x.at === 'number' && x.data) : [] } catch { return [] } }
function writeHist(list: BackupItem[]) { try { localStorage.setItem(HIST_KEY, JSON.stringify(list)) } catch { /* ignore */ } }

// ===== 云端历史快照（user_snapshots 表，多设备共享，数据库自动保留最近20份）=====
export interface CloudSnapshot { id: number; reason: string | null; data: AppData; createdAt: string }
function toCloudSnapshot(row: { id: number; reason: string | null; data: unknown; created_at: string }): CloudSnapshot {
  return { id: row.id, reason: row.reason, data: normalize(row.data), createdAt: row.created_at }
}

function emptyData(): AppData {
  return {
    version: 2,
    accounts: [],
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    holdings: [],
    trades: [],
    people: [],
    gifts: [],
    cars: [],
    fuelRecords: [],
    carExpenses: [],
    goals: [],
    events: [],
    anniversaries: [],
    customReminders: [],
    borrows: [],
    settings: { birthdayAdvanceDays: 5, repaymentAdvanceDays: 5, monthlyBudget: 8000, categoryBudgets: {} },
  }
}

// 统一的数据归一化：兼容旧版本备份/导入，自动补齐所有字段
function normalize(raw: unknown): AppData {
  const base = emptyData()
  const d = { ...base, ...(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) } as Record<string, unknown>
  d.version = 2
  if (!d.settings || typeof d.settings !== 'object') d.settings = base.settings
  else d.settings = { ...base.settings, ...(d.settings as object) }
  const arrKeys = ['categories', 'accounts', 'transactions', 'holdings', 'trades', 'people', 'gifts', 'cars', 'fuelRecords', 'carExpenses', 'goals', 'events', 'anniversaries', 'customReminders', 'borrows']
  for (const k of arrKeys) if (!Array.isArray(d[k])) d[k] = (base as unknown as Record<string, unknown>)[k]
  return d as unknown as AppData
}

const ID_KEYS = ['accounts','transactions','categories','holdings','trades','people','gifts','cars','fuelRecords','carExpenses','goals','events','anniversaries','customReminders','borrows']
/** 合并两份数据：按 id 取并集（本机优先），设置项本机逐项优先、云端补缺——保证两边都不丢 */
function mergeData(a: AppData, b: AppData): AppData {
  const la = normalize(a)
  const rb = normalize(b)
  const out = normalize({ ...la, ...rb })
  out.settings = { ...rb.settings, ...la.settings }
  for (const k of ID_KEYS) {
    const m = new Map<string, unknown>()
    const arrA = (la as unknown as Record<string, unknown>)[k] as { id: string }[] | undefined || []
    const arrB = (rb as unknown as Record<string, unknown>)[k] as { id: string }[] | undefined || []
    for (const x of arrA) m.set(x.id, x)
    for (const x of arrB) if (!m.has(x.id)) m.set(x.id, x)
    ;(out as unknown as Record<string, unknown>)[k] = [...m.values()]
  }
  return out
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch { /* ignore */ }
  return buildDemoData()
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>
export type NewTrade = Omit<Trade, 'id'>

interface StoreApi {
  data: AppData
  syncError: string
  saving: boolean
  lastSavedAt: number
  history: BackupItem[]
  backupNow: (reason?: string) => void
  restoreHistory: (at: number) => void
  deleteHistory: (at: number) => void
  cloudSnapshots: CloudSnapshot[]
  cloudSnapshotsLoading: boolean
  refreshCloudSnapshots: () => Promise<void>
  restoreCloudSnapshot: (id: number) => Promise<void>
  deleteCloudSnapshot: (id: number) => Promise<void>
  addAccount: (a: Omit<Account, 'id'>) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  deleteAccount: (id: string) => void
  addTransaction: (t: NewTransaction) => void
  deleteTransaction: (id: string) => void
  updateTransaction: (id: string, patch: Partial<Pick<Transaction, 'date' | 'amount' | 'categoryId' | 'note' | 'toAccountId'>>) => void
  addCategory: (c: Omit<Category, 'id'>) => void
  updateCategory: (id: string, patch: Partial<Category>) => void
  deleteCategory: (id: string) => void
  applyTrade: (t: NewTrade) => void
  deleteTrade: (id: string) => void
  updateHoldingNote: (id: string, note?: string) => void
  addPerson: (p: Omit<Person, 'id'>) => void
  updatePerson: (id: string, patch: Partial<Person>) => void
  deletePerson: (id: string) => void
  addGift: (g: Omit<Gift, 'id'>) => void
  deleteGift: (id: string) => void
  addCar: (c: Omit<Car, 'id'>) => void
  updateCar: (id: string, patch: Partial<Car>) => void
  deleteCar: (id: string) => void
  addFuel: (f: Omit<FuelRecord, 'id'>) => void
  deleteFuel: (id: string) => void
  addCarExpense: (e: Omit<CarExpense, 'id'>) => void
  deleteCarExpense: (id: string) => void
  addGoal: (g: Omit<Goal, 'id'>) => void
  updateGoal: (id: string, patch: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  addEvent: (e: Omit<FinancialEvent, 'id'>) => void
  deleteEvent: (id: string) => void
  addAnniversary: (a: Omit<Anniversary, 'id'>) => void
  updateAnniversary: (id: string, patch: Partial<Anniversary>) => void
  deleteAnniversary: (id: string) => void
  addCustomReminder: (c: Omit<CustomReminder, 'id'>) => void
  updateCustomReminder: (id: string, patch: Partial<CustomReminder>) => void
  deleteCustomReminder: (id: string) => void
  addBorrow: (b: Omit<Borrow, 'id'>) => void
  updateBorrow: (id: string, patch: Partial<Borrow>) => void
  deleteBorrow: (id: string) => void
  setSettings: (patch: Partial<AppData['settings']>) => void
  loadDemo: () => void
  clearAll: () => void
  importData: (d: AppData) => void
}

const Ctx = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(load)
  const [cloudUid, setCloudUid] = useState<string | null>(null)
  const [syncError, setSyncError] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(0)
  const dataRef = useRef(data)
  const hydratedRef = useRef(false)
  const lastSentRef = useRef('')
  const baseSigRef = useRef('')
  const saveBusyRef = useRef(false)
  const lastCheckRef = useRef(0)
  const saveSeqRef = useRef(0)
  const cloudReadyRef = useRef(cloudReady)
  const cloudUidRef = useRef<string | null>(null)
  const dirtyRef = useRef(readDirty())
  const [history, setHistory] = useState<BackupItem[]>(readHist)
  const [cloudSnapshots, setCloudSnapshots] = useState<CloudSnapshot[]>([])
  const [cloudSnapshotsLoading, setCloudSnapshotsLoading] = useState(false)

  useEffect(() => { dataRef.current = data }, [data])
  useEffect(() => { cloudUidRef.current = cloudUid }, [cloudUid])

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch { /* ignore */ }
  }, [data])

  // 单线程保存：同一时刻只允许一个上传在途；每次上传前读取最新数据，
  // 上传完成后若又有新改动则继续发最新版，保证顺序 = “最后改的”一定最后上传，
  // 从根上消除“旧上传晚到、把新结果盖回去”的间歇性问题
  const drainSaveRef = useRef<() => Promise<void>>(async () => {})
  drainSaveRef.current = async () => {
    if (saveBusyRef.current) return
    saveBusyRef.current = true
    try {
      // 合并保险：云端出现本机尚未见过的更新时，先把两边合并（谁都不丢），再上传
      const ensureFresh = async () => {
        if (!supabase || !cloudUidRef.current) return
        if (Date.now() - lastCheckRef.current < 1500) return
        lastCheckRef.current = Date.now()
        try {
          const { data: row } = await supabase!.from('user_state').select('data').eq('user_id', cloudUidRef.current).maybeSingle()
          const remote = row?.data as Record<string, unknown> | undefined
          if (!remote || typeof remote !== 'object' || !Object.keys(remote).length) return
          const sig = stableJson(remote)
          if (sig === baseSigRef.current) return
          baseSigRef.current = sig
          const merged = mergeData(normalize(dataRef.current), normalize(remote))
          const msig = stableJson(merged)
          if (msig !== stableJson(dataRef.current)) {
            dataRef.current = merged
            dirtyRef.current = true
            writeDirty(true)
            setData(merged)
          }
        } catch { /* 拉取失败不阻塞，稍后自动重试 */ }
      }
      for (;;) {
        if (!cloudReadyRef.current || !supabase || !cloudUidRef.current || !hydratedRef.current) break
        await ensureFresh()
        const payload = dataRef.current
        const sig = stableJson(payload)
        if (sig === lastSentRef.current) break
        lastSentRef.current = sig
        setSaving(true)
        let attempt = 0
        let ok = false
        for (;;) {
          try {
            await supabase!.from('user_state').upsert({ user_id: cloudUidRef.current, data: payload }, { onConflict: 'user_id' })
            ok = true
            break
          } catch {
            if (!cloudUidRef.current) break
            setSyncError('网络不稳定，正在自动重试保存…（你的数据仍在本机，不会丢）')
            const delay = Math.min(300 * Math.pow(2, Math.min(attempt, 4)), 4000)
            await new Promise((r) => setTimeout(r, delay))
            attempt++
            if (stableJson(dataRef.current) !== sig) break // 等待期间数据又变了：放弃旧内容，用最新重发
          }
        }
        if (!ok) continue
        setSyncError('')
        baseSigRef.current = sig
        dirtyRef.current = false
        writeDirty(false)
        if (stableJson(dataRef.current) === sig) { setSaving(false); setLastSavedAt(Date.now()) }
      }
    } finally {
      saveBusyRef.current = false
      setSaving(false)
    }
  }

  // 云端：登录会话监听 + 初始拉取 / 首次上传
  useEffect(() => {
    let unsub: (() => void) | undefined
    ;(async () => {
      if (!cloudReadyRef.current || !supabase) return
      const loadRemote = async (uid: string) => {
        try {
          const { data: row } = await supabase!.from('user_state').select('data').eq('user_id', uid).maybeSingle()
          const remote = row?.data as Record<string, unknown> | undefined
          const hasRemote = !!(remote && typeof remote === 'object' && Object.keys(remote).length)
          if (hasRemote && !dirtyRef.current) {
            lastSentRef.current = stableJson(remote)
            baseSigRef.current = lastSentRef.current
            setData(normalize(remote))
          } else {
            try {
              const localN = normalize(dataRef.current)
              const merged = hasRemote ? mergeData(localN, normalize(remote as Record<string, unknown>)) : localN
              const msig = stableJson(merged)
              if (msig !== stableJson(dataRef.current)) {
                dataRef.current = merged
                setData(merged)
              }
              lastSentRef.current = msig
              baseSigRef.current = msig
              await supabase!.from('user_state').upsert({ user_id: uid, data: dataRef.current }, { onConflict: 'user_id' })
              writeDirty(false)
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
        hydratedRef.current = true
      }
      const u = await getCloudUser()
      if (u) { setCloudUid(u.id); await loadRemote(u.id); await refreshCloudSnapshotsRef.current() }
      const { data: auth } = supabase!.auth.onAuthStateChange(async (_e, session) => {
        if (session?.user) { setCloudUid(session.user.id); hydratedRef.current = false; await loadRemote(session.user.id); await refreshCloudSnapshotsRef.current() }
        else { setCloudUid(null); hydratedRef.current = false; setCloudSnapshots([]) }
      })
      unsub = auth?.subscription.unsubscribe
    })()
    return () => { unsub?.() }
  }, [])

  // 云端：任何本地改动 → 排队触发单线程保存
  useEffect(() => {
    if (!cloudReadyRef.current || !supabase || !cloudUid || !hydratedRef.current) return
    if (stableJson(data) === lastSentRef.current) return
    dirtyRef.current = true
    writeDirty(true)
    const timer = setTimeout(() => { void drainSaveRef.current() }, 25)
    return () => clearTimeout(timer)
  }, [data, cloudUid])

  // 云端：页面切后台 / 关闭前，立即补发一次（防止移动端杀进程导致改动没传上去）
  useEffect(() => {
    const flush = () => {
      if (!cloudReadyRef.current || !supabase || !cloudUidRef.current || !hydratedRef.current) return
      const payload = dataRef.current
      if (stableJson(payload) === lastSentRef.current) return
      ;(async () => { try { await supabase!.from('user_state').upsert({ user_id: cloudUidRef.current, data: payload }, { onConflict: 'user_id' }); setSyncError(''); baseSigRef.current = stableJson(payload); dirtyRef.current = false; writeDirty(false) } catch { /* 后台发送失败：本地数据仍在，下次打开会继续处理 */ } })()
    }
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // 云端：回到前台 / 联网时，若本地没有未上传改动，则拉取云端最新（防陈旧覆盖）
  useEffect(() => {
    const refresh = () => {
      if (!cloudReadyRef.current || !supabase || !cloudUidRef.current || !hydratedRef.current) return
      try { if (stableJson(dataRef.current) !== lastSentRef.current) return } catch { return }
      ;(async () => {
        try {
          const { data: row } = await supabase!.from('user_state').select('data').eq('user_id', cloudUidRef.current).maybeSingle()
          const remote = row?.data as Record<string, unknown> | undefined
          if (!remote || typeof remote !== 'object' || !Object.keys(remote).length) return
          const sig = stableJson(remote)
          if (sig !== baseSigRef.current) { lastSentRef.current = sig; baseSigRef.current = sig; setData(normalize(remote)) }
        } catch { /* 拉取失败静默，稍后再试 */ }
      })()
    }
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // 云端：其它设备更新 → 实时接收（忽略自己上传的回声）
  useEffect(() => {
    if (!cloudReadyRef.current || !supabase || !cloudUid) return
    const channel = supabase!.channel('state-sync-' + cloudUid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_state', filter: `user_id=eq.${cloudUid}` }, (payload) => {
        if (!hydratedRef.current) return
        const remote = (payload.new as { data?: Record<string, unknown> } | null)?.data
        if (!remote || typeof remote !== 'object') return
        const sig = stableJson(remote)
        if (sig === lastSentRef.current) return
        if (sig === stableJson(dataRef.current)) { lastSentRef.current = sig; baseSigRef.current = sig; dirtyRef.current = false; writeDirty(false); return }
        lastSentRef.current = sig
        baseSigRef.current = sig
        dirtyRef.current = false
        writeDirty(false)
        setData(normalize(remote))
      })
      .subscribe()
    return () => { supabase!.removeChannel(channel) }
  }, [cloudUid])

  const pushHistory = (reason: string) => {
    const item: BackupItem = { at: Date.now(), reason, data: dataRef.current }
    setHistory((h) => { const next = [item, ...h].slice(0, HIST_MAX); writeHist(next); return next })
    // 云端可用时，同步写一份到 user_snapshots（多设备共享）
    if (cloudReadyRef.current && supabase && cloudUidRef.current && hydratedRef.current) {
      ;(async () => {
        try {
          await supabase!.from('user_snapshots').insert({ user_id: cloudUidRef.current, reason, data: dataRef.current })
          await refreshCloudSnapshotsRef.current()
        } catch { /* 云端快照写入失败不影响本地历史 */ }
      })()
    }
  }
  const restoreHistory = (at: number) => {
    const item = history.find((h) => h.at === at)
    if (!item) return
    pushHistory('恢复备份（' + item.reason + '）')
    setData(normalize(item.data))
  }
  const deleteHistory = (at: number) => {
    setHistory((h) => { const next = h.filter((x) => x.at !== at); writeHist(next); return next })
  }

  // ===== 云端快照：读取列表 / 恢复 / 删除 =====
  const refreshCloudSnapshotsRef = useRef<() => Promise<void>>(async () => {})
  refreshCloudSnapshotsRef.current = async () => {
    if (!cloudReadyRef.current || !supabase || !cloudUidRef.current) { setCloudSnapshots([]); return }
    setCloudSnapshotsLoading(true)
    try {
      const { data: rows } = await supabase!.from('user_snapshots').select('id,reason,data,created_at').order('created_at', { ascending: false }).limit(20)
      setCloudSnapshots((rows || []).map(toCloudSnapshot))
    } catch { setCloudSnapshots([]) }
    finally { setCloudSnapshotsLoading(false) }
  }
  const restoreCloudSnapshot = async (id: number) => {
    const snap = cloudSnapshots.find((s) => s.id === id)
    if (!snap) return
    pushHistory('恢复云端备份（' + (snap.reason || '#' + id) + '）')
    setData(normalize(snap.data))
  }
  const deleteCloudSnapshot = async (id: number) => {
    if (!supabase || !cloudUidRef.current) return
    try {
      await supabase.from('user_snapshots').delete().eq('id', id).eq('user_id', cloudUidRef.current)
      setCloudSnapshots((list) => list.filter((s) => s.id !== id))
    } catch { /* ignore */ }
  }

  const api = useMemo<StoreApi>(() => {
    const withBalances = (d: AppData, tx: NewTransaction): Account[] => {
      const map = new Map(d.accounts.map((a) => [a.id, { ...a }]))
      const acc = map.get(tx.accountId)
      const to = tx.toAccountId ? map.get(tx.toAccountId) : undefined
      if (!acc) return d.accounts
      if (tx.type === 'income') acc.balance += tx.amount
      else if (tx.type === 'expense') acc.balance -= tx.amount
      else if (tx.type === 'transfer') {
        acc.balance -= tx.amount
        if (to) to.balance += tx.amount
      } else if (tx.type === 'repay') {
        acc.balance -= tx.amount
        if (to) to.balance = Math.max(0, to.balance - tx.amount)
      }
      return [...map.values()]
    }

    return {
      data,
      syncError,
      saving,
      lastSavedAt,
      history,
      backupNow: (reason?: string) => pushHistory(reason || '手动存档'),
      restoreHistory,
      deleteHistory,
      cloudSnapshots,
      cloudSnapshotsLoading,
      refreshCloudSnapshots: () => refreshCloudSnapshotsRef.current(),
      restoreCloudSnapshot,
      deleteCloudSnapshot,
      addAccount: (a) => setData((d) => ({ ...d, accounts: [...d.accounts, { ...a, id: uid() }] })),
      updateAccount: (id, patch) => setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch, id } : a)) })),
      deleteAccount: (id) => setData((d) => ({
        ...d,
        accounts: d.accounts.filter((a) => a.id !== id),
        holdings: d.holdings.filter((h) => h.accountId !== id),
        trades: d.trades.filter((t) => t.accountId !== id),
        transactions: d.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id),
      })),
      addTransaction: (t) => setData((d) => {
        const tx: Transaction = { ...t, id: uid(), createdAt: Date.now() }
        return { ...d, transactions: [...d.transactions, tx], accounts: withBalances(d, t) }
      }),
      deleteTransaction: (id) => setData((d) => {
        const tx = d.transactions.find((t) => t.id === id)
        if (!tx) return d
        const rev: NewTransaction = { date: tx.date, type: tx.type, amount: tx.amount, accountId: tx.accountId, toAccountId: tx.toAccountId, categoryId: tx.categoryId, note: tx.note }
        // 反向：构造一个类型相同但余额变化取反的临时对象
        const map = new Map(d.accounts.map((a) => [a.id, { ...a }]))
        const acc = map.get(tx.accountId)
        const to = tx.toAccountId ? map.get(tx.toAccountId) : undefined
        if (acc) {
          if (tx.type === 'income') acc.balance -= tx.amount
          else if (tx.type === 'expense') acc.balance += tx.amount
          else if (tx.type === 'transfer') { acc.balance += tx.amount; if (to) to.balance -= tx.amount }
          else if (tx.type === 'repay') { acc.balance += tx.amount; if (to) to.balance += tx.amount }
        }
        return { ...d, transactions: d.transactions.filter((x) => x.id !== id), accounts: [...map.values()] }
      }),
      updateTransaction: (id, patch) => setData((d) => {
        const old = d.transactions.find((t) => t.id === id)
        if (!old) return d
        const map = new Map(d.accounts.map((a) => [a.id, { ...a }]))
        const acc = map.get(old.accountId)
        const to = old.toAccountId ? map.get(old.toAccountId) : undefined
        if (acc) {
          if (old.type === 'income') acc.balance -= old.amount
          else if (old.type === 'expense') acc.balance += old.amount
          else if (old.type === 'transfer') { acc.balance += old.amount; if (to) to.balance -= old.amount }
          else if (old.type === 'repay') { acc.balance += old.amount; if (to) to.balance += old.amount }
        }
        const updated: Transaction = { ...old, ...patch }
        const acc2 = map.get(updated.accountId)
        const to2 = updated.toAccountId ? map.get(updated.toAccountId) : undefined
        if (acc2) {
          if (updated.type === 'income') acc2.balance += updated.amount
          else if (updated.type === 'expense') acc2.balance -= updated.amount
          else if (updated.type === 'transfer') { acc2.balance -= updated.amount; if (to2) to2.balance += updated.amount }
          else if (updated.type === 'repay') { acc2.balance -= updated.amount; if (to2) to2.balance = Math.max(0, to2.balance - updated.amount) }
        }
        return { ...d, transactions: d.transactions.map((x) => (x.id === id ? updated : x)), accounts: [...map.values()] }
      }),
      addCategory: (c) => setData((d) => ({ ...d, categories: [...d.categories, { ...c, id: uid() }] })),
      updateCategory: (id, patch) => setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteCategory: (id) => setData((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id) })),
      applyTrade: (t) => setData((d) => {
        const acc = d.accounts.find((a) => a.id === t.accountId)
        if (!acc || acc.category !== 'securities') return d
        const holding = d.holdings.find((h) => h.accountId === t.accountId && h.symbol === t.symbol)
        let holdings = [...d.holdings]
        const cost = t.shares * t.price + (t.fee || 0)
        if (t.side === 'buy') {
          if (holding) {
            holdings = holdings.map((h) => h.id === holding.id ? { ...h, shares: h.shares + t.shares, avgCost: (h.shares * h.avgCost + cost) / (h.shares + t.shares) } : h)
          } else {
            holdings = [...holdings, { id: uid(), accountId: t.accountId, symbol: t.symbol, name: t.name, shares: t.shares, avgCost: t.price + (t.fee || 0) / t.shares }]
          }
          acc.balance -= cost
        } else {
          const canSell = holding ? Math.min(t.shares, holding.shares) : 0
          if (canSell <= 0) return d
          holdings = holdings.map((h) => h.id === holding!.id ? { ...h, shares: h.shares - canSell } : h).filter((h) => h.shares > 0)
          acc.balance += canSell * t.price - (t.fee || 0)
        }
        const trade: Trade = { ...t, id: uid() }
        return { ...d, holdings, trades: [...d.trades, trade], accounts: d.accounts.map((a) => (a.id === acc.id ? acc : a)) }
      }),
      deleteTrade: (id) => setData((d) => ({ ...d, trades: d.trades.filter((t) => t.id !== id) })),
      updateHoldingNote: (id, note) => setData((d) => ({ ...d, holdings: d.holdings.map((h) => (h.id === id ? { ...h, note } : h)) })),
      addPerson: (p) => setData((d) => ({ ...d, people: [...d.people, { ...p, id: uid() }] })),
      updatePerson: (id, patch) => setData((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePerson: (id) => setData((d) => ({ ...d, people: d.people.filter((p) => p.id !== id), gifts: d.gifts.filter((g) => g.personId !== id) })),
      addGift: (g) => setData((d) => ({ ...d, gifts: [...d.gifts, { ...g, id: uid() }] })),
      deleteGift: (id) => setData((d) => ({ ...d, gifts: d.gifts.filter((g) => g.id !== id) })),
      addCar: (c) => setData((d) => ({ ...d, cars: [...d.cars, { ...c, id: uid() }] })),
      updateCar: (id, patch) => setData((d) => ({ ...d, cars: d.cars.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteCar: (id) => setData((d) => ({ ...d, cars: d.cars.filter((c) => c.id !== id), fuelRecords: d.fuelRecords.filter((f) => f.carId !== id), carExpenses: d.carExpenses.filter((e) => e.carId !== id) })),
      addFuel: (f) => setData((d) => ({ ...d, fuelRecords: [...d.fuelRecords, { ...f, id: uid() }] })),
      deleteFuel: (id) => setData((d) => ({ ...d, fuelRecords: d.fuelRecords.filter((f) => f.id !== id) })),
      addCarExpense: (e) => setData((d) => ({ ...d, carExpenses: [...d.carExpenses, { ...e, id: uid() }] })),
      deleteCarExpense: (id) => setData((d) => ({ ...d, carExpenses: d.carExpenses.filter((e) => e.id !== id) })),
      addGoal: (g) => setData((d) => ({ ...d, goals: [...d.goals, { ...g, id: uid() }] })),
      updateGoal: (id, patch) => setData((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGoal: (id) => setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) })),
      addEvent: (e) => setData((d) => ({ ...d, events: [...d.events, { ...e, id: uid() }] })),
      deleteEvent: (id) => setData((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) })),
      addAnniversary: (a) => setData((d) => ({ ...d, anniversaries: [...d.anniversaries, { ...a, id: uid() }] })),
      updateAnniversary: (id, patch) => setData((d) => ({ ...d, anniversaries: d.anniversaries.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteAnniversary: (id) => setData((d) => ({ ...d, anniversaries: d.anniversaries.filter((x) => x.id !== id) })),
      addCustomReminder: (c) => setData((d) => ({ ...d, customReminders: [...d.customReminders, { ...c, id: uid() }] })),
      updateCustomReminder: (id, patch) => setData((d) => ({ ...d, customReminders: d.customReminders.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteCustomReminder: (id) => setData((d) => ({ ...d, customReminders: d.customReminders.filter((x) => x.id !== id) })),
      addBorrow: (b) => setData((d) => ({ ...d, borrows: [...d.borrows, { ...b, id: uid() }] })),
      updateBorrow: (id, patch) => setData((d) => ({ ...d, borrows: d.borrows.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteBorrow: (id) => setData((d) => ({ ...d, borrows: d.borrows.filter((x) => x.id !== id) })),
      setSettings: (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      loadDemo: () => { pushHistory('载入演示数据'); setData(buildDemoData()) },
      clearAll: () => { pushHistory('清空全部数据'); setData(emptyData()) },
      importData: (d) => { pushHistory('导入数据'); setData(normalize(d)) },
    }
  }, [data, history, cloudSnapshots, cloudSnapshotsLoading])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useApp(): StoreApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used within StoreProvider')
  return v
}

export function monthKey(d: string | Date = new Date()) {
  return dayjs(d).format('YYYY-MM')
}










