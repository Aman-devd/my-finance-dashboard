import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { Button, Card, Empty, Field, Modal, PageHead, TextInput, TextArea, cx } from '../components/ui'
import { KeyRound, Plus, Pencil, Trash2, Eye, EyeOff, Copy, Lock, ShieldAlert, Dice5, Search } from 'lucide-react'
import { secureEnv, encryptEntries, decryptEntries, randomPassword, type VaultEntry, type VaultPayload } from '../lib/vaultCrypto'
import { uid } from '../lib/format'

const LS_KEY = 'fin.vault.v1'

function readPayload(): VaultPayload | null {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) as VaultPayload : null } catch { return null }
}
function writePayload(p: VaultPayload) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)) } catch { /* ignore */ } }

export default function Vault() {
  const { data } = useApp() // 保持与登录账号同框（正式版按账号隔离）
  const [master, setMaster] = useState('')
  const [step, setStep] = useState<'loading' | 'noMaster' | 'unlock' | 'open'>(() => {
    if (!secureEnv()) return 'loading'
    return readPayload() ? 'unlock' : 'noMaster'
  })
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [key, setKey] = useState('') // 仅在内存中的保险箱密码
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [form, setForm] = useState<{ open: boolean; entry?: VaultEntry }>({ open: false })
  const [reveal, setReveal] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState('')

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return entries
    return entries.filter((e) => e.title.toLowerCase().includes(kw) || e.username.toLowerCase().includes(kw) || (e.url || '').toLowerCase().includes(kw) || (e.note || '').toLowerCase().includes(kw))
  }, [entries, q])

  async function saveEntries(next: VaultEntry[]) {
    const payload = await encryptEntries(next, key)
    writePayload(payload)
    setEntries(next)
  }

  async function setMasterNow() {
    if (pw.length < 6) { setErr('保险箱密码至少 6 位'); return }
    if (pw !== pw2) { setErr('两次输入的密码不一致'); return }
    setErr('')
    const payload = await encryptEntries([], pw)
    writePayload(payload)
    setKey(pw); setEntries([]); setPw(''); setPw2(''); setStep('open')
  }

  async function unlock() {
    const payload = readPayload()
    if (!payload) { setStep('noMaster'); return }
    const list = await decryptEntries(payload, pw)
    if (!list) { setErr('保险箱密码不对，再试试'); return }
    setErr(''); setEntries(list); setKey(pw); setPw(''); setStep('open')
  }

  async function changeMaster() {
    const n = window.prompt('请输入新的保险箱密码（至少 6 位）')
    if (!n || n.length < 6) return
    const c = window.prompt('再输一次确认')
    if (n !== c) { alert('两次输入不一致'); return }
    const payload = await encryptEntries(entries, n)
    writePayload(payload)
    setKey(n)
    alert('保险箱密码已修改（所有密码已用新密码重新加密）')
  }

  async function copyText(v: string, id: string) {
    try { await navigator.clipboard.writeText(v); setCopied(id); setTimeout(() => setCopied(''), 1200) } catch {
      const ta = document.createElement('textarea')
      ta.value = v; document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
      setCopied(id); setTimeout(() => setCopied(''), 1200)
    }
  }

  if (step === 'loading' || (!secureEnv())) {
    return (
      <div>
        <PageHead title="密码保险箱" />
        <Card className="p-6">
          <div className="text-center py-6">
            <ShieldAlert size={40} className="mx-auto text-amber-500" />
            <h2 className="font-bold mt-3">当前环境不支持安全加密</h2>
            <p className="text-sm text-slate-500 mt-2 leading-6">密码保险箱需要 HTTPS 加密环境才能开启（本机 localhost 可以）。<br />手机用 http 局域网访问时，为保护你的密码安全，本功能不会打开。<br />正式上线（HTTPS）后，手机即可正常使用。</p>
          </div>
        </Card>
      </div>
    )
  }

  if (step === 'noMaster') {
    return (
      <div className="max-w-md mx-auto">
        <PageHead title="设置保险箱密码" sub="首次使用：所有密码将用这个密码加密保存" />
        <Card className="p-5 space-y-3">
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-blue-50 rounded-xl p-3 leading-5"><Lock size={14} className="shrink-0 mt-0.5 text-blue-600" />请设置一个单独的"保险箱密码"（和登录密码不同更安全）。请务必记牢：忘记后密码无法找回。</div>
          <Field label="保险箱密码（至少 6 位）"><TextInput type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="再次输入"><TextInput type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          {err && <div className="text-xs text-red-500">{err}</div>}
          <Button className="w-full" onClick={setMasterNow}>创建保险箱</Button>
        </Card>
      </div>
    )
  }

  if (step === 'unlock') {
    return (
      <div className="max-w-md mx-auto">
        <PageHead title="密码保险箱" sub="输入保险箱密码解锁" />
        <Card className="p-5 space-y-3">
          <Field label="保险箱密码"><TextInput type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && unlock()} autoFocus /></Field>
          {err && <div className="text-xs text-red-500">{err}</div>}
          <Button className="w-full" onClick={unlock}><KeyRound size={16} /> 解锁</Button>
          <div className="text-[11px] text-slate-400">解锁状态仅保留在本次打开期间，刷新/重新打开需再次输入，更安全。</div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHead title="密码保险箱" sub={`已保存 ${entries.length} 条 · 端到端加密`} right={<Button onClick={() => setForm({ open: true })}><Plus size={16} /> 新增</Button>} />

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <TextInput className="!pl-9" placeholder="搜索平台 / 账号 / 网址" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="outline" onClick={changeMaster}>改保险箱密码</Button>
      </div>

      {list.length === 0 && <Card><Empty text={entries.length ? '没有匹配的结果' : '还没有保存任何密码，点右上角新增'} /></Card>}

      <div className="space-y-2">
        {list.map((e) => (
          <Card key={e.id} className="p-3.5">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-slate-800 text-white grid place-items-center text-xs font-bold">{e.title.slice(0, 1)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{e.title}</div>
                <div className="text-[11px] text-slate-400 truncate">{e.username || '—'}{e.url ? ` · ${e.url}` : ''}</div>
              </div>
              <button onClick={() => setForm({ open: true, entry: e })} className="text-slate-400 p-1"><Pencil size={15} /></button>
              <button onClick={() => { if (window.confirm(`删除「${e.title}」？`)) saveEntries(entries.filter((x) => x.id !== e.id)) }} className="text-red-400 p-1"><Trash2 size={15} /></button>
            </div>
            <div className="mt-2 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-400 w-10 shrink-0">密码</span>
              <code className={cx('flex-1 num text-sm font-medium', reveal[e.id] ? '' : 'tracking-[0.25em]')}>{reveal[e.id] ? e.password : '••••••••'}</code>
              <button onClick={() => setReveal({ ...reveal, [e.id]: !reveal[e.id] })} className="text-slate-500">{reveal[e.id] ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              <button onClick={() => copyText(e.password, e.id)} className="text-blue-600">{copied === e.id ? '已复制 ✓' : <Copy size={15} />}</button>
            </div>
            {e.note && <div className="text-[11px] text-slate-400 mt-1.5 px-1">{e.note}</div>}
          </Card>
        ))}
      </div>

      {form.open && <EntryForm entry={form.entry} onClose={() => setForm({ open: false })} onSave={(entry) => {
        const next = form.entry ? entries.map((x) => (x.id === entry.id ? entry : x)) : [...entries, entry]
        saveEntries(next)
        setForm({ open: false })
      }} />}
    </div>
  )
}

function EntryForm({ entry, onClose, onSave }: { entry?: VaultEntry; onClose: () => void; onSave: (e: VaultEntry) => void }) {
  const [title, setTitle] = useState(entry?.title || '')
  const [username, setUsername] = useState(entry?.username || '')
  const [password, setPassword] = useState(entry?.password || '')
  const [url, setUrl] = useState(entry?.url || '')
  const [note, setNote] = useState(entry?.note || '')
  const [show, setShow] = useState(false)
  const ok = title.trim() && password
  return (
    <Modal open title={entry ? '编辑密码' : '新增密码'} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!ok} onClick={() => onSave({ id: entry?.id || uid(), title: title.trim(), username: username.trim(), password, url: url.trim() || undefined, note: note || undefined, updatedAt: Date.now() })}>保存</Button></>}>
      <div className="space-y-3">
        <Field label="平台 / 网站名称"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：招商银行 / 微信 / 邮箱" autoFocus /></Field>
        <Field label="账号 / 用户名"><TextInput value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
        <Field label="密码">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <TextInput type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="!pr-9" />
              <button onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())} title="生成随机密码"><Dice5 size={16} /></Button>
          </div>
        </Field>
        <Field label="网址（可选）"><TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
        <Field label="备注（可选）"><TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：生日问题答案 / 绑定的手机号" /></Field>
      </div>
    </Modal>
  )
}
