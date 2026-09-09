import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useApp } from '../lib/store'
import { ensureFits } from '../lib/fitText'
import { addQuoteSymbol, useLiveQuotes } from '../lib/quotes'
import { Home, Wallet, List, TrendingUp, Bell, Users, Car, Calculator, Settings, Plus, Target, Activity, Menu, X, Sparkles, PieChart, BarChart3, Coins, CalendarDays, Repeat, Fuel, HandCoins, KeyRound, LogOut } from 'lucide-react'

export interface NavItem { to: string; label: string; icon: React.ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>; section?: boolean }

export const NAV: NavItem[] = [
  { to: '/', label: '首页', icon: Home },
  { to: '/transactions', label: '流水', icon: List },
  { to: '/accounts', label: '账户', icon: Wallet },
  { to: '/markets', label: '行情', icon: TrendingUp },
  { to: '/gains', label: '收益', icon: Activity },
  { to: '/annual', label: '年度', icon: CalendarDays },
  { to: '/people', label: '人情', icon: Users },
  { to: '/borrow', label: '借贷', icon: HandCoins },
  { to: '/cars', label: '车辆', icon: Car },
  { to: '/tools', label: '工具', icon: Calculator },
  { to: '/vault', label: '密码箱', icon: KeyRound },
  { to: '/more', label: '我的', icon: Settings },
]

const MOBILE_BOTTOM: NavItem[] = [
  { to: '/', label: '首页', icon: Home },
  { to: '/markets', label: '行情', icon: TrendingUp },
  { to: '/add', label: '记一笔', icon: Plus },
  { to: '/reminders', label: '提醒', icon: Bell },
  { to: '/more', label: '我的', icon: Settings },
]

function titleOf(path: string): string {
  if (path.startsWith('/add')) return '记一笔'
  if (path.startsWith('/transactions')) return '流水'
  if (path.startsWith('/accounts')) return '账户'
  if (path.startsWith('/markets')) return '行情'
  if (path.startsWith('/annual')) return '年度总结'
  if (path.startsWith('/holdings')) return '持仓'
  if (path.startsWith('/people')) return '人情往来'
  if (path.startsWith('/cars')) return '车辆管理'
  if (path.startsWith('/reminders')) return '提醒中心'
  if (path.startsWith('/tools')) return '工具箱'
  if (path.startsWith('/more')) return '我的'
  return '首页'
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const title = titleOf(loc.pathname)

  // 全局行情订阅：所有页面都能实时更新行情
  useLiveQuotes()

  // 应用启动时立即加载所有持仓标的的行情（不用等进入持仓页面）
  const { data, syncError, saving, lastSavedAt } = useApp()
  useEffect(() => {
    const allSymbols = [...new Set(data.holdings.filter((h) => h.shares > 0).map((h) => h.symbol))]
    allSymbols.forEach((symbol) => addQuoteSymbol(symbol))
  }, [data.holdings])

  // 切换页面时回到顶部
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [loc.pathname])

  const { user, logout } = useAuth()
  const [justSaved, setJustSaved] = useState(false)
  useEffect(() => {
    if (lastSavedAt > 0) {
      setJustSaved(true)
      const t = window.setTimeout(() => setJustSaved(false), 1800)
      return () => window.clearTimeout(t)
    }
  }, [lastSavedAt])
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  // 数字自适应：内容/尺寸变化后立即缩小超宽数字，避免先大后小
  useEffect(() => {
    let timer: number | undefined
    const run = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => ensureFits(), 0)
    }
    ensureFits()
    const root = document.getElementById('root') || document.body
    const mo = new MutationObserver(run)
    mo.observe(root, { childList: true, subtree: true })
    window.addEventListener('resize', run)
    window.addEventListener('orientationchange', run)
    return () => { mo.disconnect(); window.removeEventListener('resize', run); window.removeEventListener('orientationchange', run); window.clearTimeout(timer) }
  }, [])

  const NavLinkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${isActive ? 'bg-[#0071e3]/10 text-[#0071e3] font-semibold shadow-[0_1px_2px_rgba(0,113,227,0.1)]' : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'}`
  const darkNavCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${isActive ? 'bg-[#0071e3]/10 text-[#0071e3] font-semibold shadow-[0_1px_2px_rgba(0,113,227,0.1)]' : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'}`

  return (
    <div className="min-h-full">
      {offline && !syncError && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[70] bg-slate-800/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-sm">当前离线，数据会先保存在本机，联网后自动同步</div>
      )}
      {(syncError || saving || justSaved) && (
        <div className={"fixed top-2 left-1/2 -translate-x-1/2 z-[70] text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-sm " + (syncError ? "bg-amber-100 text-amber-800" : saving ? "bg-white/90 text-slate-600 border border-slate-200" : "bg-emerald-50 text-emerald-700")}>
          {syncError ? syncError : saving ? '正在同步到云端…' : '✓ 已保存到云端'}
        </div>
      )}
      {/* 桌面侧边栏 */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col glass-strong px-3 py-5">
        <div className="flex items-center gap-2.5 px-3 mb-7">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0071e3] to-[#005bb5] text-white grid place-items-center shadow-[0_2px_8px_rgba(0,113,227,0.3)]"><Coins size={20} /></div>
          <div>
            <div className="font-bold leading-tight text-slate-900 tracking-tight">我的财务台</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1"><Sparkles size={10} /> 云端同步</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-auto">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={darkNavCls}>
              <n.icon size={18} strokeWidth={2} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-2 px-3 pt-3">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/40 border border-white/50">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0a84ff] to-[#005bb5] text-white grid place-items-center text-[15px] font-bold uppercase shrink-0 shadow-md">{user?.username?.slice(0, 1)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{user?.username}</div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5 leading-tight">{user?.email || '本地演示账号'}</div>
            </div>
            <button onClick={() => { if (window.confirm('确定退出登录吗？')) logout() }} className="p-2 rounded-xl text-slate-400 hover:bg-white/60 hover:text-red-500 transition-all" title="退出登录"><LogOut size={16} /></button>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-slate-500 font-medium">v3.2 · 云端自动同步</span>
          </div>
        </div>
      </aside>

      {/* 手机顶栏 */}
      <header className="md:hidden sticky top-2.5 z-40 mx-4 px-4 py-3 flex items-center gap-3 rounded-[22px]" style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.72) 50%, rgba(255,255,255,0.78) 100%)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.85)',
        boxShadow: '0 8px 28px rgba(15,23,42,0.12), 0 3px 8px rgba(15,23,42,0.06), inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -1px 1px rgba(255,255,255,0.5), inset 0 0 20px rgba(255,255,255,0.1)'
      }}>
        <button onClick={() => setOpen(true)} className="p-1 -ml-1 text-slate-600 hover:text-slate-900 transition-colors"><Menu size={22} /></button>
        <div className="flex-1 min-w-0 font-bold text-[17px] truncate tracking-tight">{title}</div>
        <NavLink to="/reminders" className="relative p-1 text-slate-500 hover:text-slate-900 transition-colors"><Bell size={20} /></NavLink>
      </header>

      {/* 手机抽屉菜单 */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl p-4 flex flex-col animate-pop">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0071e3] to-[#005bb5] text-white grid place-items-center shadow-sm"><Coins size={17} /></div>
                <span className="font-bold tracking-tight">我的财务台</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-slate-500 hover:text-slate-900 transition-colors"><X size={20} /></button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-auto">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setOpen(false)} className={NavLinkCls}>
                  <n.icon size={18} strokeWidth={2} /> {n.label}
                </NavLink>
              ))}
              <div className="pt-2 mt-2 border-t border-slate-100 px-3 text-[11px] text-slate-400 leading-5">演示数据存于本机，可在「我的」里一键清空或重新载入演示。</div>
            </nav>
          </div>
        </div>
      )}

      {/* 主内容 */}
      <main className="md:pl-60">
        <div className="mx-auto max-w-6xl px-5 py-6 md:py-10 pb-32 md:pb-14">
          <Outlet />
        </div>
      </main>

      {/* 手机底部导航 - iOS Dock 风格 胶囊状柔和色 */}
      <nav className="md:hidden fixed bottom-2.5 inset-x-4 z-40 rounded-[26px] overflow-hidden" style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.45) 100%)',
        backdropFilter: 'blur(30px) saturate(200%)',
        WebkitBackdropFilter: 'blur(30px) saturate(200%)',
        border: '1.5px solid rgba(255,255,255,0.6)',
        boxShadow: '0 -8px 32px rgba(15,23,42,0.12), 0 -3px 10px rgba(15,23,42,0.06), 0 0 30px rgba(255,255,255,0.25), inset 0 1.5px 2px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(15,23,42,0.05)'
      }}>
        <div className="grid grid-cols-5 h-[72px] px-1.5 pb-[env(safe-area-inset-bottom)] items-center justify-items-center">
          {MOBILE_BOTTOM.map((n, idx) => {
            const active = n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)
            // 每个图标的超柔和渐变色（灰调，低饱和）
            const gradients = [
              'linear-gradient(145deg, #a8c4e0 0%, #7a9cc0 60%, #6888a8 100%)', // 首页 超柔和蓝
              'linear-gradient(145deg, #a8d4bc 0%, #7ab898 60%, #68a084 100%)', // 行情 超柔和绿
              'linear-gradient(145deg, #9abce8 0%, #6a98d0 50%, #5884b8 100%)', // 记一笔 超柔和亮蓝
              'linear-gradient(145deg, #e8c898 0%, #d0a870 60%, #b89058 100%)', // 提醒 超柔和橙
              'linear-gradient(145deg, #c8c8cc 0%, #a8a8ac 60%, #909094 100%)', // 我的 超柔和灰
            ]
            const gradient = gradients[idx] || gradients[0]
            
            if (n.to === '/add') {
              return (
                <NavLink key={n.to} to="/add" className="flex flex-col items-center gap-1 active:scale-90 transition-transform touch-manipulation">
                  <span className="w-16 h-11 rounded-full grid place-items-center text-white relative overflow-hidden" style={{ background: gradient, boxShadow: '0 3px 10px rgba(74,123,184,0.35), 0 1px 2px rgba(74,123,184,0.2), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 3px rgba(0,0,0,0.12)' }}>
                    <span className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-full" />
                    <Plus size={20} strokeWidth={2.5} className="relative z-10" />
                  </span>
                  <span className="text-[9px] font-medium text-[#4a7ab8]">记一笔</span>
                </NavLink>
              )
            }
            return (
              <NavLink key={n.to} to={n.to} className={`flex flex-col items-center gap-1 active:scale-90 transition-transform touch-manipulation ${active ? '' : 'opacity-70'}`}>
                <span className="w-16 h-11 rounded-full grid place-items-center text-white relative overflow-hidden" style={{ background: gradient, boxShadow: active ? '0 3px 10px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 3px rgba(0,0,0,0.12)' : '0 2px 5px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -2px 3px rgba(0,0,0,0.1)' }}>
                  <span className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-full" />
                  <n.icon size={18} strokeWidth={2} className="relative z-10" />
                </span>
                <span className={`text-[9px] ${active ? 'font-semibold text-slate-700' : 'font-medium text-slate-500'}`}>{n.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
