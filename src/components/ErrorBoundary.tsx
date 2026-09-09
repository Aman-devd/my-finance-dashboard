import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: unknown) {
    return { err: e instanceof Error ? e.message : String(e) }
  }
  render() {
    if (this.state.err) {
      return (
        <div className="min-h-[100dvh] bg-[#f2f2f7] grid place-items-center px-6">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-[0_10px_40px_-16px_rgba(0,0,0,.18)]">
            <AlertTriangle size={28} className="mx-auto mb-2 text-amber-500" />
            <div className="font-bold text-slate-900">页面出了点问题</div>
            <div className="text-xs text-slate-400 mt-1.5 leading-5 break-all max-h-24 overflow-auto">{this.state.err}</div>
            <button onClick={() => window.location.reload()} className="mt-5 w-full inline-flex items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-700">重新加载</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
