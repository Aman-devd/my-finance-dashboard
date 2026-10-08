import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ===== 云端连接（Supabase）=====
const env = import.meta.env as Record<string, string | undefined>
const URL = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY

/** 云端请求超时（毫秒）：连不上时快速降级，不让用户干等 */
const CLOUD_TIMEOUT_MS = 8000

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), CLOUD_TIMEOUT_MS)
  return fetch(input, { ...(init || {}), signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

export const cloudReady: boolean = !!(URL && KEY)
export const supabase: SupabaseClient | null = cloudReady
  ? createClient(URL as string, KEY as string, { global: { fetch: fetchWithTimeout } })
  : null

// ===== 云端在线状态（供登录降级 / UI 提示使用）=====
let cloudOnline = cloudReady
const onlineSubs = new Set<(online: boolean) => void>()

export function isCloudOnline(): boolean { return cloudOnline }

export function subscribeCloudOnline(fn: (online: boolean) => void): () => void {
  onlineSubs.add(fn)
  return () => { onlineSubs.delete(fn) }
}

function setCloudOnline(v: boolean) {
  if (cloudOnline !== v) {
    cloudOnline = v
    for (const fn of [...onlineSubs]) { try { fn(v) } catch { /* ignore */ } }
  }
}

/** 探测云端是否可达（轻量请求，用于后台自动重连判断） */
export async function probeCloud(): Promise<boolean> {
  if (!cloudReady || !supabase) return false
  try {
    const k = KEY as string
    const r = await fetchWithTimeout(URL + '/rest/v1/', { headers: { apikey: k, Authorization: 'Bearer ' + k } })
    setCloudOnline(r.ok || r.status === 401 || r.status === 404)
    return cloudOnline
  } catch {
    setCloudOnline(false)
    return false
  }
}

/** 判断一个错误是否属于“网络不可达”（区别于密码错误等业务错误） */
export function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /fetch|network|abort|timeout|Failed to fetch|Load failed|ERR_|TypeError/i.test(msg)
}

/** 用户名 → 云端账号邮箱（内部约定域名，用户无需关心邮箱） */
export const cloudEmailOf = (username: string): string => `${username.trim().toLowerCase()}@finance.local`

/** 云端登录/注册是否已启用且需要 Supabase 里先建表 */
export function cloudErrorHint(errText: string): string {
  if (/relation "public\.user_meta" does not exist|user_meta|user_state/i.test(errText)) {
    return '云端数据表还没建：请先在 Supabase → SQL Editor 里执行 supabase/schema.sql 再试'
  }
  if (/email/i.test(errText)) return '该邮箱未验证或未开启邮箱确认，请在 Supabase Auth 设置里关闭 Email confirmation 后重试'
  return errText
}

/** 读取当前云会话用户 */
export async function getCloudUser(): Promise<{ id: string } | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    setCloudOnline(true)
    return data.session?.user ?? null
  } catch {
    setCloudOnline(false)
    return null
  }
}
