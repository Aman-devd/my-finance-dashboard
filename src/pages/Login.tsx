import { useState } from 'react'
import { useAuth, DEFAULT_USERNAME, DEFAULT_FULL_PASSWORD } from '../lib/auth'
import { Button, Field, TextInput, cx } from '../components/ui'
import { Coins, Eye, EyeOff, Lock, User as UserIcon, Mail, ShieldCheck } from 'lucide-react'

export default function Login() {
  const { login, register, ready, cloud } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState(DEFAULT_USERNAME)          // 登录自动带出账号
  const [password, setPassword] = useState(DEFAULT_USERNAME)          // 自动带出前缀，只需补 84265
  const [rUsername, setRUsername] = useState('')
  const [rEmail, setREmail] = useState('')
  const [rPassword, setRPassword] = useState('')
  const [rPassword2, setRPassword2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function doLogin() {
    setErr(''); setBusy(true)
    const e = await login(username, password)
    if (e) setErr(e)
    setBusy(false)
  }

  async function doRegister() {
    setErr(''); setNotice('')
    if (rPassword !== rPassword2) { setErr('两次输入的密码不一致'); return }
    setBusy(true)
    const e = await register(rUsername, rEmail, rPassword)
    if (e) setErr(e); else setNotice('注册成功，已自动登录')
    setBusy(false)
  }

  if (!ready) return <Splash />

  return (
    <div className="min-h-full bg-[#f2f2f7] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="w-14 h-14 mx-auto rounded-[1.4rem] bg-white border border-slate-200 text-blue-600 grid place-items-center shadow-sm"><Coins size={30} /></div>
          <h1 className="text-[22px] font-bold tracking-tight mt-3 text-[#1d1d1f]">我的财务台</h1>
          <p className="text-[13px] text-slate-400 mt-1">个人财务 · 投资 · 人情 · 车辆 一账通</p>
        </div>

        <div className="bg-white rounded-[1.4rem] border border-black/5 shadow-[0_10px_40px_-16px_rgba(0,0,0,.18)] p-6">
          <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 mb-5">
            <button onClick={() => { setMode('login'); setErr(''); setNotice('') }} className={cx('py-2 rounded-lg text-sm font-semibold transition', mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-500')}>登 录</button>
            <button onClick={() => { setMode('register'); setErr(''); setNotice('') }} className={cx('py-2 rounded-lg text-sm font-semibold transition', mode === 'register' ? 'bg-white shadow text-slate-900' : 'text-slate-500')}>注 册</button>
          </div>

          {mode === 'login' ? (
            <div className="space-y-3">
              <Field label="账号">
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <TextInput className="!pl-9" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                </div>
              </Field>
              <Field label="密码">
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <TextInput className="!pl-9 !pr-10" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={(e) => { if (e.key === 'Enter') doLogin() }} />
                  <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><Eye size={17} /></button>
                </div>
              </Field>
              {err && <div className="text-xs text-red-500">{err}</div>}
              <Button className="w-full !py-2.5" disabled={busy} onClick={doLogin}>{busy ? '登录中…' : '登 录'}</Button>
              <div className="text-[11px] text-slate-400 leading-4 bg-slate-50 rounded-xl p-2.5">
                {cloud ? '使用你的云端账号登录' : <>演示账号已带出：账号 <b>Amanbol</b>，密码框已预填 <b>Amanbol</b>，<b>只需再输入 84265</b> 即可登录。</>}
                登录后 <b>90 天免登录</b>（期间偶尔打开会自动续期）。密码连续错 <b>3 次将锁定 1 小时</b>。
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="账号（字母/数字/下划线）">
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <TextInput className="!pl-9" value={rUsername} onChange={(e) => setRUsername(e.target.value)} placeholder="如 aman2026" autoComplete="username" />
                </div>
              </Field>
              <Field label="邮箱（找回密码用，建议填）">
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <TextInput className="!pl-9" value={rEmail} onChange={(e) => setREmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="密码（至少6位）">
                  <TextInput type={showPw ? 'text' : 'password'} value={rPassword} onChange={(e) => setRPassword(e.target.value)} autoComplete="new-password" />
                </Field>
                <Field label="确认密码">
                  <TextInput type="password" value={rPassword2} onChange={(e) => setRPassword2(e.target.value)} autoComplete="new-password" />
                </Field>
              </div>
              {err && <div className="text-xs text-red-500">{err}</div>}
              {notice && <div className="text-xs text-emerald-600">{notice}</div>}
              <Button className="w-full !py-2.5" disabled={busy} onClick={doRegister}>{busy ? '注册中…' : '注册并登录'}</Button>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-1.5 text-[10px] text-slate-400 leading-4">
            <ShieldCheck size={13} className="shrink-0 mt-0.5 text-emerald-500" />
            <span>{cloud ? '✓ 已连接云端：多设备实时同步已开启，数据自动加密备份' : '当前为本地演示登录（账号保存在本机浏览器）'}</span>
          </div>
        </div>

        {mode === 'register' && <p className="text-center text-[11px] text-slate-300 mt-3">提示：密码请至少 6 位；正式版上线后，你注册的这个账号将自动成为唯一可用账号（开放注册会关闭）。</p>}
      </div>
    </div>
  )
}

function Splash() {
  return (
    <div className="min-h-full bg-[#f2f2f7] grid place-items-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600 grid place-items-center animate-pulse"><Coins size={24} /></div>
        <div className="text-sm mt-3 text-slate-400">正在准备…</div>
      </div>
    </div>
  )
}








