import React from 'react'
import { Inbox, X, Calendar } from 'lucide-react'

export function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(' ')
}

export function Card({ className, children, onClick, style }: { className?: string; children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  const hasBg = typeof className === 'string' && /(^|\s)bg-/.test(className)
  return (
    <div onClick={onClick} style={style} className={cx(!hasBg && 'glass-card', 'rounded-3xl', onClick && 'cursor-pointer transition-all duration-200 hover:bg-white/10 hover:border-white/20 active:opacity-90 active:scale-[0.995]', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-3 mt-6 first:mt-0">
      <h3 className="text-[14px] font-semibold tracking-tight text-slate-700">{children}</h3>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'soft' | 'outline'
export function Button({ variant = 'primary', className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-[#0071e3] text-white shadow-[0_1px_3px_rgba(0,113,227,0.3),0_1px_2px_rgba(0,113,227,0.2)] hover:bg-[#0077ed] hover:shadow-[0_4px_12px_rgba(0,113,227,0.35)] active:bg-[#006edb] active:shadow-[0_1px_2px_rgba(0,113,227,0.3)]',
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700',
    soft: 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900',
    outline: 'border border-white/60 bg-white/40 backdrop-blur-md text-slate-700 hover:bg-white/50 hover:border-white/70 hover:text-slate-900 shadow-sm',
  }
  return (
    <button className={cx('inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]', styles[variant], className)} {...rest}>
      {children}
    </button>
  )
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none transition-all duration-200 hover:border-slate-300 focus:border-[#0071e3] focus:ring-[3px] focus:ring-[#0071e3]/12 placeholder:text-slate-400 text-slate-900'
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, 'min-h-[72px]', props.className)} />
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, props.className)} />
}

// 日期输入框：带日历图标，确保移动端弹出日期选择器
export function DateInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input type="date" {...props} className={cx(inputCls, 'pr-9', props.className)} />
      <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  )
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-[1.75rem] sm:rounded-2xl border border-slate-200/50 max-h-[92vh] overflow-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-pop shadow-[0_24px_64px_-16px_rgba(15,23,42,0.35),0_8px_24px_-8px_rgba(15,23,42,0.2)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="关闭" className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 grid place-items-center transition hover:bg-slate-200 hover:text-slate-700 active:scale-95"><X size={16} /></button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  )
}

export function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-slate-100/80 p-1 backdrop-blur-sm">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cx('px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200', value === o.value ? 'bg-white/70 backdrop-blur-sm shadow-[0_1px_3px_rgba(15,23,42,0.1),0_1px_2px_rgba(15,23,42,0.06)] text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, color = '#2563eb', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cx('h-2 rounded-full bg-slate-100 overflow-hidden', className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  )
}

export function Tag({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'red' | 'blue' | 'amber' | 'violet' }) {
  const map = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-slate-100 text-slate-600',
  }
  return <span className={cx('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium', map[tone])}>{children}</span>
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="py-10 text-center text-slate-400 text-sm">
      <Inbox size={30} strokeWidth={1.5} className="mx-auto mb-2 text-slate-300" />
      <div>{text}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function MoneyText({ value, className, colored = true }: { value: number; className?: string; colored?: boolean }) {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : value > 0 ? '+' : ''
  const cls = colored ? (value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-500' : 'text-slate-500') : 'text-slate-800'
  return <span className={cx('num', cls, className)}>{sign}{abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight text-[#0f172a] leading-tight">{title}</h1>
        {sub && <p className="text-[13px] text-slate-500 mt-1.5 leading-5">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}























