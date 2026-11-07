import type { CustomCategory, Tx } from './types.ts'

/**
 * The last data this phone saw, so the app opens straight to it instead of a blank screen.
 * Bound to one account; App clears it as soon as the session turns out to be gone or someone else's.
 */
export interface Cached {
  user: string
  tx?: Tx[]
  categories?: CustomCategory[]
  budgets?: Record<string, number>
}

const KEY = 'memoney.cache'
let user: string | undefined
/** Sign out after this long without a tap (App's idle logout); saved data expires with it. */
export const IDLE_MS = 7 * 24 * 60 * 60_000
/** "<session id> <ms of last tap>", written by App's idle logout */
export const ACTIVE_KEY = 'memoney.active'

function read(): Cached | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cached | null
    return v && typeof v.user === 'string' ? v : undefined
  } catch { return undefined }
}

/** Idle for 7 days counts as signed out, even when the server can't be reached to say so. */
function recentlyActive(): boolean {
  try {
    const ms = Number((localStorage.getItem(ACTIVE_KEY) ?? '').split(' ')[1])
    return !!ms && Date.now() - ms <= IDLE_MS
  } catch { return false }
}

/** Read once at startup, before the first render. */
export const cached = recentlyActive() ? read() : (clearCache(), undefined)

/** Writes are dropped until the signed-in account is confirmed. */
export function setCacheUser(id: string) { user = id }

export function writeCache<K extends 'tx' | 'categories' | 'budgets'>(part: K, value: Cached[K]) {
  if (!user) return
  try {
    const current = read()
    localStorage.setItem(KEY, JSON.stringify({ ...(current?.user === user ? current : {}), user, [part]: value }))
  } catch { /* full or blocked storage: the app still works, just opens slower */ }
}

export function clearCache() {
  user = undefined
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
