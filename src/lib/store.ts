import { useSyncExternalStore } from 'react'
import type { Tx } from './types'
import { monthKey, shiftWeek, today } from './format'

export interface TxRepo {
  list(): Tx[]
  /** photo: a JPEG to attach, null to remove it, undefined to leave it */
  save(tx: Tx, photo?: Blob | null): void
  remove(id: string): void
  subscribe(fn: () => void): () => void
}

/** Server-backed; writes are optimistic, and a failed write reloads from the server. */
function apiRepo(): TxRepo & { load(): Promise<void> } {
  const listeners = new Set<() => void>()
  let cache: Tx[] = []
  const set = (next: Tx[]) => {
    cache = next
    listeners.forEach((l) => l())
  }
  const call = (path: string, init?: RequestInit) =>
    fetch(`/api/tx/${path}`, { credentials: 'include', ...init }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${path}`)
      return r
    })
  const put = (tx: Tx) =>
    call(tx.id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(tx) })
  const reload = (err: unknown) => {
    console.error('[repo]', err)
    void repo.load()
  }

  const repo = {
    list: () => cache,
    async load() {
      await importLocal(put)
      set(await (await call('')).json())
    },
    save(tx: Tx, photo?: Blob | null) {
      const saved = photo === null ? { ...tx, photoAt: undefined } : tx
      set([...cache.filter((t) => t.id !== tx.id), saved])
      // the photo row points at the transaction, so it goes up only after the transaction exists
      put(tx)
        .then(async () => {
          if (photo === undefined) return
          if (photo === null) return void await call(`${tx.id}/photo`, { method: 'DELETE' })
          const { photoAt } = (await (await call(`${tx.id}/photo`, {
            method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: photo,
          })).json()) as { photoAt: number }
          set(cache.map((t) => (t.id === tx.id ? { ...t, photoAt } : t)))
        })
        .catch(reload)
    },
    remove(id: string) {
      set(cache.filter((t) => t.id !== id))
      call(id, { method: 'DELETE' }).catch(reload)
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  return repo
}

/** One-time upload of transactions saved on this device before accounts existed. */
async function importLocal(put: (tx: Tx) => Promise<unknown>) {
  const key = 'pocket.tx'
  let local: Tx[] = []
  try {
    local = JSON.parse(localStorage.getItem(key) ?? '[]') as Tx[]
  } catch {
    /* ignore */
  }
  if (!local.length) return
  for (const tx of local) await put(tx)
  localStorage.removeItem(key)
}

export const repo = apiRepo()

const byNewest = (a: Tx, b: Tx) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt

export function useTransactions(): Tx[] {
  return useSyncExternalStore(repo.subscribe, repo.list)
}

export function forMonth(txs: Tx[], month: string): Tx[] {
  return txs.filter((t) => monthKey(t.date) === month).sort(byNewest)
}

export function forWeek(txs: Tx[], week: string): Tx[] {
  const end = shiftWeek(week, 1)
  return txs.filter((t) => t.date >= week && t.date < end).sort(byNewest)
}

export function totals(txs: Tx[]) {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense, balance: income - expense }
}

/* ---- tiny shared UI state: selected month, prefs, auth ---- */

function atom<T>(key: string, initial: T, persist = true) {
  let value: T = initial
  if (persist) {
    try {
      const raw = localStorage.getItem(key)
      if (raw != null) value = JSON.parse(raw) as T
    } catch {
      /* ignore */
    }
  }
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      if (persist) {
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* ignore */
        }
      }
      listeners.forEach((l) => l())
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}

type Atom<T> = ReturnType<typeof atom<T>>

export function useAtom<T>(a: Atom<T>): [T, (v: T) => void] {
  return [useSyncExternalStore(a.subscribe, a.get), a.set]
}

export const monthAtom = atom('pocket.month', monthKey(today()), false)
export const currencyAtom = atom('pocket.currency', '$')
