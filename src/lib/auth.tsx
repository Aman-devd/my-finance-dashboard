import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, cloudReady, cloudEmailOf, cloudErrorHint, getCloudUser } from './cloud'

// ===== 账号与会话：云端优先，未配置云端时退回本地演示 =====
const USERS_KEY = 'fin.users.v1'
const SESSION_KEY = 'fin.session.v1'
const LOCK_KEY = 'fin.lock.v1'
export const DEFAULT_USERNAME = 'Amanbol'
export const DEFAULT_FULL_PASSWORD = 'Amanbol84265'
const SESSION_MS = 90 * 24 * 3600 * 1000
const MAX_ATTEMPTS = 3
const LOCK_MS = 60 * 60 * 1000

interface LocalUser { username: string; email?: string; hash: string }
interface Session { username: string; expiresAt: number }
interface LockRecord { count: number; lockedUntil?: number }

const salt = (u: string) => `fin::${u.toLowerCase()}::`

async function digest(text: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch { /* ignore */ }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

function readUsers(): LocalUser[] { try { const r = localStorage.getItem(USERS_KEY); return r ? JSON.parse(r) : [] } catch { return [] } }
function writeUsers(list: LocalUser[]) { try { localStorage.setItem(USERS_KEY, JSON.stringify(list)) } catch { /* ignore */ } }
function readSession(): Session | null { try { const r = localStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null } catch { return null } }
function readLocks(): Record<string, LockRecord> { try { const r = localStorage.getItem(LOCK_KEY); return r ? JSON.parse(r) : {} } catch { return {} } }
function writeLocks(l: Record<string, LockRecord>) { try { localStorage.setItem(LOCK_KEY, JSON.stringify(l)) } catch { /* ignore */ } }

export interface AuthUser { username: string; email?: string }
interface AuthApi {
  ready: boolean
  cloud: boolean
  user: AuthUser | null
  login: (username: string, password: string) => Promise<string | null>
  register: (username: string, email: string | undefined, password: string) => Promise<string | null>
  logout: () => void
}
const Ctx = createContext<AuthApi | null>(null)

async function fetchMeta(uid: string): Promise<AuthUser | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.from('user_meta').select('username,email').eq('user_id', uid).maybeSingle()
    if (data && data.username) return { username: data.username, email: data.email || undefined }
  } catch { /* ignore */ }
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    ;(async () => {
      if (cloudReady && supabase) {
        try {
          const cu = await getCloudUser()
          if (cu) setUser(await fetchMeta(cu.id))
          const { data } = supabase.auth.onAuthStateChange(async (_e, session) => {
            if (session?.user) setUser(await fetchMeta(session.user.id))
            else setUser(null)
          })
          unsub = data?.subscription.unsubscribe
        } finally {
          setReady(true)
        }
        return
      }
      // —— 本地演示模式 ——
      try {
        let list = readUsers()
        if (!list.length) {
          const hash = await digest(DEFAULT_FULL_PASSWORD + salt(DEFAULT_USERNAME))
          list = [{ username: DEFAULT_USERNAME, hash }]
          writeUsers(list)
        }
        const s = readSession()
        if (s && s.expiresAt > Date.now()) {
          const rec = list.find((x) => x.username === s.username)
          if (rec) {
            setUser({ username: rec.username, email: rec.email })
            writeSession({ username: rec.username, expiresAt: Date.now() + SESSION_MS })
          }
        }
      } finally {
        setReady(true)
      }
    })()
    return () => { unsub?.() }
  }, [])

  function writeSession(s: Session) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* ignore */ } }

  const lockMsg = (until: number) => {
    const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000))
    return `密码错误次数过多，账号已锁定，请 ${Math.floor(mins / 60) > 0 ? `${Math.floor(mins / 60)} 小时 ${mins % 60} 分` : `${mins} 分`} 后再试`
  }

  async function login(username: string, password: string): Promise<string | null> {
    const name = username.trim()
    if (!name || !password) return '请输入账号和密码'
    const key = name.toLowerCase()
    const locks = readLocks()
    const lock = locks[key]
    if (lock?.lockedUntil && lock.lockedUntil > Date.now()) return lockMsg(lock.lockedUntil)
    if (lock?.lockedUntil && lock.lockedUntil <= Date.now()) { delete locks[key]; writeLocks(locks) }

    const onFail = (msg: string): string => {
      const count = (lock?.count || 0) + 1
      if (count >= MAX_ATTEMPTS) { writeLocks({ ...readLocks(), [key]: { count, lockedUntil: Date.now() + LOCK_MS } }); return '密码错误已达 3 次，账号已锁定 1 小时' }
      writeLocks({ ...readLocks(), [key]: { count } })
      return `${msg}（第 ${count}/${MAX_ATTEMPTS} 次），连续错 ${MAX_ATTEMPTS} 次将锁定 1 小时`
    }

    if (cloudReady && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: cloudEmailOf(name), password })
      if (error) return onFail(cloudErrorHint(error.message))
      const u = (await getCloudUser())
      if (u) setUser(await fetchMeta(u.id))
      if (locks[key]) { delete locks[key]; writeLocks(locks) }
      return null
    }

    // 本地
    const list = readUsers()
    const rec = list.find((x) => x.username.toLowerCase() === key)
    if (!rec) return '账号不存在，请先注册'
    const h = await digest(password + salt(rec.username))
    if (h !== rec.hash) return onFail('密码不对')
    if (locks[key]) { delete locks[key]; writeLocks(locks) }
    writeSession({ username: rec.username, expiresAt: Date.now() + SESSION_MS })
    setUser({ username: rec.username, email: rec.email })
    return null
  }

  async function register(username: string, email: string | undefined, password: string): Promise<string | null> {
    const name = username.trim()
    if (name.length < 3 || !/^[A-Za-z0-9_]+$/.test(name)) return '账号需至少 3 位，只能包含字母、数字、下划线'
    if (password.length < 6) return '密码至少 6 位'

    if (cloudReady && supabase) {
      const { data, error } = await supabase.auth.signUp({ email: cloudEmailOf(name), password, options: { data: { username: name } } })
      if (error) return cloudErrorHint(error.message)
      if (!data.session) return '注册成功，但需要先通过邮箱验证才能登录。请在 Supabase Auth 设置里关闭 Email confirmation，或直接联系我协助'
      const uid = data.user?.id
      if (uid) {
        try { await supabase.from('user_meta').insert({ user_id: uid, username: name, email: email?.trim() || undefined }) } catch { /* ignore */ }
        setUser({ username: name, email: email?.trim() || undefined })
      }
      return null
    }

    // 本地
    const list = readUsers()
    if (list.some((x) => x.username.toLowerCase() === name.toLowerCase())) return '这个账号已被占用'
    const hash = await digest(password + salt(name))
    writeUsers([...list, { username: name, email: email?.trim() || undefined, hash }])
    writeSession({ username: name, expiresAt: Date.now() + SESSION_MS })
    setUser({ username: name, email: email?.trim() || undefined })
    return null
  }

  function logout() {
    if (cloudReady && supabase) { supabase.auth.signOut().catch(() => { /* ignore */ }); setUser(null); return }
    try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
    setUser(null)
  }

  return <Ctx.Provider value={{ ready, cloud: cloudReady, user, login, register, logout }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
