import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, cloudReady, cloudEmailOf, cloudErrorHint, getCloudUser, isCloudOnline, isNetworkError, probeCloud, subscribeCloudOnline } from './cloud'

// ===== 账号与会话：云端优先，云端不可达时自动降级本地，保证随时可用 =====
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
function writeSession(s: Session) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* ignore */ } }
function readLocks(): Record<string, LockRecord> { try { const r = localStorage.getItem(LOCK_KEY); return r ? JSON.parse(r) : {} } catch { return {} } }
function writeLocks(l: Record<string, LockRecord>) { try { localStorage.setItem(LOCK_KEY, JSON.stringify(l)) } catch { /* ignore */ } }

export interface AuthUser { username: string; email?: string }
interface AuthApi {
  ready: boolean
  cloud: boolean
  cloudOnline: boolean
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

/** 用本地用户表验证账号（云端不可达时的降级入口，校验逻辑与云端一致） */
async function localLogin(username: string, password: string): Promise<string | null> {
  const list = readUsers()
  const rec = list.find((x) => x.username.toLowerCase() === username.toLowerCase())
  if (!rec) return '账号不存在，请先注册'
  const h = await digest(password + salt(rec.username))
  if (h !== rec.hash) return '密码不对'
  writeSession({ username: rec.username, expiresAt: Date.now() + SESSION_MS })
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [cloudOnline, setCloudOnline] = useState<boolean>(isCloudOnline())

  useEffect(() => {
    // 订阅云端在线状态变化（后台自动重连时同步 UI）
    const un = subscribeCloudOnline(setCloudOnline)
    return un
  }, [])

  /** 尝试从本地会话恢复（云端不可达时的免登录入口） */
  function tryRestoreLocalSession(): AuthUser | null {
    try {
      const s = readSession()
      if (s && s.expiresAt > Date.now()) {
        const rec = readUsers().find((x) => x.username === s.username)
        if (rec) {
          writeSession({ username: rec.username, expiresAt: Date.now() + SESSION_MS })
          return { username: rec.username, email: rec.email }
        }
      }
    } catch { /* ignore */ }
    return null
  }

  useEffect(() => {
    let unsub: (() => void) | undefined
    ;(async () => {
      if (cloudReady && supabase) {
        try {
          const cu = await getCloudUser()
          if (cu) {
            const meta = await fetchMeta(cu.id)
            if (meta) { setUser(meta); writeSession({ username: meta.username, expiresAt: Date.now() + SESSION_MS }) }
            else setUser(tryRestoreLocalSession())
          } else {
            // 云端无会话：若云端不可达则用本地会话恢复；云端可达则视为已登出
            setUser(isCloudOnline() ? null : tryRestoreLocalSession())
          }
          const { data } = supabase.auth.onAuthStateChange(async (_e, session) => {
            if (session?.user) {
              const meta = await fetchMeta(session.user.id)
              setUser(meta || tryRestoreLocalSession())
            } else {
              setUser(isCloudOnline() ? null : tryRestoreLocalSession())
            }
          })
          unsub = data?.subscription.unsubscribe
        } finally {
          setReady(true)
        }
        return
      }
      // —— 本地模式 ——
      try {
        let list = readUsers()
        if (!list.length) {
          const hash = await digest(DEFAULT_FULL_PASSWORD + salt(DEFAULT_USERNAME))
          list = [{ username: DEFAULT_USERNAME, hash }]
          writeUsers(list)
        }
        setUser(tryRestoreLocalSession())
      } finally {
        setReady(true)
      }
    })()
    return () => { unsub?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      if (error) {
        // 网络不可达 → 自动降级本地验证，保证随时能登录
        if (isNetworkError(error)) {
          const localErr = await localLogin(name, password)
          if (localErr) {
            return localErr === '账号不存在，请先注册'
              ? '云端暂时不可用，且本机没有这个账号。请先注册，或稍后网络恢复再试'
              : localErr + '（云端不可用，已尝试本地验证）'
          }
          if (locks[key]) { delete locks[key]; writeLocks(locks) }
          setUser({ username: name })
          void probeCloud()
          return null
        }
        return onFail(cloudErrorHint(error.message))
      }
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
      if (error) {
        // 网络不可达 → 降级本地注册
        if (isNetworkError(error)) {
          const list = readUsers()
          if (list.some((x) => x.username.toLowerCase() === name.toLowerCase())) return '这个账号已被占用'
          const hash = await digest(password + salt(name))
          writeUsers([...list, { username: name, email: email?.trim() || undefined, hash }])
          writeSession({ username: name, expiresAt: Date.now() + SESSION_MS })
          setUser({ username: name, email: email?.trim() || undefined })
          void probeCloud()
          return null
        }
        return cloudErrorHint(error.message)
      }
      if (!data.session) return '注册成功，但需要先通过邮箱验证才能登录。请在 Supabase Auth 设置里关闭 Email confirmation，或直接联系我协助'
      const uid = data.user?.id
      if (uid) {
        try { await supabase.from('user_meta').insert({ user_id: uid, username: name, email: email?.trim() || undefined }) } catch { /* ignore */ }
        setUser({ username: name, email: email?.trim() || undefined })
        writeSession({ username: name, expiresAt: Date.now() + SESSION_MS })
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
    try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
    if (cloudReady && supabase) { supabase.auth.signOut().catch(() => { /* ignore */ }) }
    setUser(null)
  }

  return <Ctx.Provider value={{ ready, cloud: cloudReady, cloudOnline, user, login, register, logout }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
