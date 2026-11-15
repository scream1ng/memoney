import { useSyncExternalStore } from 'react'
import { cached, writeCache, type OutboxOp } from './cache.ts'
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

/** fetch rejects with a TypeError only when the request never reached a server: no signal, DNS, connection dropped. */
export const isOffline = (err: unknown) => err instanceof TypeError

class HttpError extends Error {
  status: number
  constructor(status: number, path: string) { super(`${status} ${path}`); this.status = status }
}
/** Worth trying again later: no connection, signed out (401/403), or the server is down (5xx), rather than refusing the change itself. */
const retryLater = (err: unknown) => isOffline(err) || (err instanceof HttpError && (err.status >= 500 || err.status === 401 || err.status === 403))

/**
 * Server-backed; publish writes only after the server confirms them.
 * With no connection, entries (without a photo) and deletes wait in an outbox on this phone,
 * show at once, and are sent on the next load (start, return to the app, pull-to-refresh, back online).
 */
function apiRepo(): TxRepo & { load(): Promise<void>; outbox(): Record<string, OutboxOp>; flush(): Promise<void> } {
  const listeners = new Set<() => void>()
  let server: Tx[] = cached?.tx ?? []
  let outbox: Record<string, OutboxOp> = cached?.outbox ?? {}
  // what the screens show: the server's list with the waiting changes laid over it
  const overlay = () => [
    ...server.filter((t) => !outbox[t.id]),
    ...Object.values(outbox).flatMap((o) => (o.op === 'put' ? [o.tx] : [])),
  ]
  let view = overlay()
  // bumped by every confirmed write, so a list fetched before the write can't undo it
  let version = 0
  const publish = () => {
    view = overlay()
    listeners.forEach((l) => l())
  }
  const setServer = (next: Tx[]) => {
    server = next
    writeCache('tx', next)
    publish()
  }
  const setOutbox = (next: Record<string, OutboxOp>) => {
    outbox = next
    writeCache('outbox', next)
    publish()
  }
  const without = (id: string) => {
    const { [id]: _, ...rest } = outbox
    return rest
  }
  const call = (path: string, init?: RequestInit) =>
    fetch(`/api/tx/${path}`, { credentials: 'include', ...init }).then((r) => {
      if (!r.ok) throw new HttpError(r.status, path)
      return r
    })
  const put = (tx: Tx) =>
    call(tx.id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(tx) })
  const del = (id: string) => call(id, { method: 'DELETE' })

  let flushing: Promise<void> | undefined
  /** Sends waiting changes one by one; stops at the first sign of still being offline. */
  const send = async () => {
    for (const [id, o] of Object.entries(outbox)) {
      if (outbox[id] !== o) continue // changed again while sending: the newer one goes next time
      try {
        if (o.op === 'put') await put(o.tx)
        else await del(id).catch((err: unknown) => { if (!(err instanceof HttpError && err.status === 404)) throw err }) // already gone
      } catch (err) {
        if (retryLater(err)) return
        if (outbox[id] !== o) continue
        // a refused entry (e.g. its category was deleted) stays, marked, so the user can fix it;
        // a refused delete is dropped, so the entry shows again rather than vanishing for good
        setOutbox(o.op === 'put' ? { ...outbox, [id]: { ...o, failed: true } } : without(id))
        continue
      }
      version++
      if (outbox[id] === o) outbox = without(id)
      setServer(o.op === 'put' ? [...server.filter((t) => t.id !== id), o.tx] : server.filter((t) => t.id !== id))
      writeCache('outbox', outbox)
    }
  }
  // set before clearing, so an empty outbox can't leave a finished promise stuck in `flushing`
  const flush = () => flushing ??= send().finally(() => { flushing = undefined })

  const repo = {
    list: () => view,
    outbox: () => outbox,
    flush,
    async load() {
      await importLocal(put)
      await flush()
      const started = version
      const list = (await (await call('')).json()) as Tx[]
      if (started === version) setServer(list)
    },
    async save(tx: Tx, photo?: Blob | null) {
      let saved = photo === null ? { ...tx, photoAt: undefined } : tx
      // an older copy of this entry may be on its way up; let it land first so this one wins
      await flushing
      try {
        await put(tx)
      } catch (err) {
        // a photo can't wait on the phone, so only plain entries are kept for later
        if (!isOffline(err) || photo !== undefined) throw err
        setOutbox({ ...outbox, [tx.id]: { op: 'put', tx } })
        return
      }
      // the photo row points at the transaction, so it goes up only after the transaction exists
      if (photo === null) await call(`${tx.id}/photo`, { method: 'DELETE' })
      else if (photo !== undefined) {
        const { photoAt } = (await (await call(`${tx.id}/photo`, {
          method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: photo,
        })).json()) as { photoAt: number }
        saved = { ...saved, photoAt }
      }
      version++
      outbox = without(tx.id)
      writeCache('outbox', outbox)
      setServer([...server.filter((t) => t.id !== tx.id), saved])
    },
    async remove(id: string) {
      // never reached the server: dropping it from the outbox is the whole delete
      // a copy of it may be on its way up right now; wait, so the delete goes after it
      await flushing
      if (outbox[id] && !server.some((t) => t.id === id)) return setOutbox(without(id))
      try {
        await del(id)
      } catch (err) {
        if (!isOffline(err)) throw err
        setOutbox({ ...outbox, [id]: { op: 'delete' } })
        return
      }
      version++
      outbox = without(id)
      writeCache('outbox', outbox)
      setServer(server.filter((t) => t.id !== id))
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

const subscribeOnline = (fn: () => void) => {
  window.addEventListener('online', fn)
  window.addEventListener('offline', fn)
  return () => { window.removeEventListener('online', fn); window.removeEventListener('offline', fn) }
}
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}

/** Changes waiting to be sent, by transaction id. */
export function useOutbox(): Record<string, OutboxOp> {
  return useSyncExternalStore(repo.subscribe, repo.outbox)
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

export function expenseByCategory(txs: Tx[]) {
  const sums = new Map<string, number>()
  for (const tx of txs) if (tx.type === 'expense') sums.set(tx.category, (sums.get(tx.category) ?? 0) + tx.amount)
  return sums
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
