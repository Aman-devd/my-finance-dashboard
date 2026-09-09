// 密码保险箱加密：AES-256-GCM，密钥由"保险箱密码"经 PBKDF2 派生
// 服务端/云端只能看到密文，无法还原明文。仅在安全环境(HTTPS/localhost)可用。

export interface VaultPayload { salt: string; iv: string; data: string } // 均为 base64
export interface VaultEntry {
  id: string
  title: string
  username: string
  password: string
  url?: string
  note?: string
  updatedAt: number
}

const ITERATIONS = 150000

export const secureEnv = (): boolean =>
  typeof crypto !== 'undefined' && !!crypto.subtle

const enc = new TextEncoder()
const dec = new TextDecoder()

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
  return btoa(s)
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out as Uint8Array<ArrayBuffer>
}

async function deriveKey(master: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode('fin-vault::' + master), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptEntries(entries: VaultEntry[], master: string): Promise<VaultPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(master, salt)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(JSON.stringify(entries)))
  return { salt: b64(salt.buffer), iv: b64(iv.buffer), data: b64(ct) }
}

/** 解密；密码错误返回 null */
export async function decryptEntries(payload: VaultPayload, master: string): Promise<VaultEntry[] | null> {
  try {
    const salt = unb64(payload.salt)
    const iv = unb64(payload.iv)
    const key = await deriveKey(master, salt)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, unb64(payload.data))
    return JSON.parse(dec.decode(plain)) as VaultEntry[]
  } catch {
    return null
  }
}

export function randomPassword(len = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length]
  return out
}

