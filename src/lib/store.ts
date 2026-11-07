import { useSyncExternalStore } from 'react'
import { cached, writeCache } from './cache.ts'
import { category } from './categories'
import type { Tx } from './types'
import { dayLabel, fromDateKey, monthKey, monthLabel, shiftDay, shiftMonth, shiftWeek, today, weekLabel, weekStart } from './format'

export interface TxRepo {
  list(): Tx[]
  /** photo: a JPEG to attach, null to remove it, undefined to leave it */
  save(tx: Tx, photo?: Blob | null): Promise<void>
  remove(id: string): Promise<void>
  subscribe(fn: () => void): () => void
}

/** Server-backed; publish writes only after the server confirms them. */
function apiRepo(): TxRepo & { load(): Promise<void> } {
  const listeners = new Set<() => void>()
  let cache: Tx[] = cached?.tx ?? []
  // bumped by every confirmed write, so a list fetched before the write can't undo it
  let version = 0
  const set = (next: Tx[]) => {
    cache = next
    writeCache('tx', next)
    listeners.forEach((l) => l())
  }
  const call = (path: string, init?: RequestInit) =>
    fetch(`/api/tx/${path}`, { credentials: 'include', ...init }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${path}`)
      return r
    })
  const put = (tx: Tx) =>
    call(tx.id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(tx) })

  const repo = {
    list: () => cache,
    async load() {
      await importLocal(put)
      const started = version
      const list = (await (await call('')).json()) as Tx[]
      if (started === version) set(list)
    },
    async save(tx: Tx, photo?: Blob | null) {
      let saved = photo === null ? { ...tx, photoAt: undefined } : tx
      await put(tx)
      // the photo row points at the transaction, so it goes up only after the transaction exists
      if (photo === null) await call(`${tx.id}/photo`, { method: 'DELETE' })
      else if (photo !== undefined) {
        const { photoAt } = (await (await call(`${tx.id}/photo`, {
          method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: photo,
        })).json()) as { photoAt: number }
        saved = { ...saved, photoAt }
      }
      version++
      set([...cache.filter((t) => t.id !== tx.id), saved])
    },
    async remove(id: string) {
      await call(id, { method: 'DELETE' })
      version++
      set(cache.filter((t) => t.id !== id))
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

export function forDay(txs: Tx[], day: string): Tx[] {
  return txs.filter((t) => t.date === day).sort(byNewest)
}

export function forWeek(txs: Tx[], week: string): Tx[] {
  const end = shiftWeek(week, 1)
  return txs.filter((t) => t.date >= week && t.date < end).sort(byNewest)
}

/** Search box match: category name, shop or note, ignoring case. */
export function matchesQuery(t: Tx, query: string): boolean {
  const q = query.trim().toLowerCase()
  return !!q && [t.note, t.merchant, category(t.category).label].some((s) => s?.toLowerCase().includes(q))
}

/** Every entry matching the search, newest first, across all time. */
export function search(txs: Tx[], query: string): Tx[] {
  return txs.filter((t) => matchesQuery(t, query)).sort(byNewest)
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

export const periodAtom = atom<Period>('pocket.period', 'month', false)
export const weekAtom = atom('pocket.week', weekStart(today()), false)
export const dayAtom = atom('pocket.day', today(), false)

export type Period = 'day' | 'week' | 'month'

/** The selected Day/Week/Month: its key, labels, which entries fall in it, and how to step it. */
export function useSelectedPeriod() {
  const [period, setPeriod] = useAtom(periodAtom)
  const [day, setDay] = useAtom(dayAtom)
  const [week, setWeek] = useAtom(weekAtom)
  const [month, setMonth] = useAtom(monthAtom)
  const base = { period, setPeriod }
  if (period === 'day') {
    // reports need an absolute date, not "Today"
    const label = fromDateKey(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    return { ...base, key: day, title: dayLabel(day), label, select: (txs: Tx[]) => forDay(txs, day), shift: (d: number) => setDay(shiftDay(day, d)) }
  }
  if (period === 'week') return { ...base, key: week, title: weekLabel(week), label: weekLabel(week), select: (txs: Tx[]) => forWeek(txs, week), shift: (d: number) => setWeek(shiftWeek(week, d)) }
  return { ...base, key: month, title: monthLabel(month), label: monthLabel(month), select: (txs: Tx[]) => forMonth(txs, month), shift: (d: number) => setMonth(shiftMonth(month, d)) }
}

const periodEnd = (period: Period, start: string) =>
  period === 'day' ? shiftDay(start, 1) : period === 'week' ? shiftWeek(start, 1) : `${shiftMonth(monthKey(start), 1)}-01`

/**
 * The stretch of the previous Day/Week/Month to compare against. While the selected period is still running,
 * only the same number of days is compared (1–7 Nov vs 1–7 Oct), so a half-finished month isn't measured against a full one.
 */
export function previousRange(period: Period, key: string, now = today()) {
  const start = period === 'month' ? `${key}-01` : key
  const end = periodEnd(period, start)
  const prevStart = period === 'day' ? shiftDay(start, -1) : period === 'week' ? shiftWeek(start, -1) : `${shiftMonth(key, -1)}-01`
  const prevFull = periodEnd(period, prevStart)
  let prevEnd = prevFull
  if (now >= start && now < end) {
    const days = Math.round((fromDateKey(now).getTime() - fromDateKey(start).getTime()) / 86_400_000) + 1
    const cut = shiftDay(prevStart, days)
    if (cut < prevFull) prevEnd = cut
  }
  return { start: prevStart, end: prevEnd, label: rangeLabel(prevStart, prevEnd) }
}

/** "1–7 Oct", "27 Oct – 2 Nov", "Sat 31 Oct" */
function rangeLabel(start: string, end: string): string {
  const last = shiftDay(end, -1)
  const a = fromDateKey(start), b = fromDateKey(last)
  if (start === last) return a.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const bText = b.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${bText}`
  return `${a.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${bText}`
}

export function inRange(txs: Tx[], range: { start: string; end: string }): Tx[] {
  return txs.filter((t) => t.date >= range.start && t.date < range.end)
}

export const deleteFailureAtom = atom<Tx | undefined>('pocket.delete-error', undefined, false)
