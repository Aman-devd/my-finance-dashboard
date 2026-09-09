import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ===== 云端连接（Supabase）=====
const env = import.meta.env as Record<string, string | undefined>
const URL = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY

export const cloudReady: boolean = !!(URL && KEY)
export const supabase: SupabaseClient | null = cloudReady ? createClient(URL as string, KEY as string) : null

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
    return data.session?.user ?? null
  } catch {
    return null
  }
}
