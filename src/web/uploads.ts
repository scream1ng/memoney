import { useSyncExternalStore } from 'react'
import { categories, categoryRepo } from '../lib/categories'
import { amountToInput, today, uid } from '../lib/format'
import { toJpeg } from '../lib/image'
import { parse, type Guess } from '../lib/parse'
import { currencyAtom } from '../lib/store'
import type { TxType } from '../lib/types'

export type Field = 'type' | 'amount' | 'date' | 'cat' | 'note' | 'merchant'
export interface Draft { type: TxType; input: string; date: string; cat?: string; note: string; merchant: string; hints: Field[] }
export type Status = 'waiting' | 'reading' | 'check' | 'failed' | 'saved' | 'skipped' | 'broken'
export interface Upload {
  id: string
  /** stable, so a retried save overwrites instead of duplicating */
  txId: string
  name: string
  status: Status
  /** the JPEG that gets stored with the entry */
  jpeg?: Blob
  url?: string
  draft: Draft
  error?: string
}

const RATE_LIMIT_MS = 60_000

let items: Upload[] = []
/** the Review receipts layer is open */
let shown = false
/** files left out of the last add because they weren't images */
let skipped = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const set = (next: Upload[]) => { items = next; emit() }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

export const useUploads = () => useSyncExternalStore(subscribe, () => items)
export const useReviewShown = () => useSyncExternalStore(subscribe, () => shown)
export const useSkipped = () => useSyncExternalStore(subscribe, () => skipped)
export const dismissSkipped = () => { skipped = 0; emit() }
export const showReview = () => { shown = true; emit() }
/** Closing drops the finished list; receipts still to check stay for next time. */
export function hideReview() {
  shown = false
  clearUploads()
  emit()
}
export const update = (id: string, patch: Partial<Upload>) => set(items.map((u) => (u.id === id ? { ...u, ...patch } : u)))
export const pending = (u: Upload) => u.status === 'waiting' || u.status === 'reading' || u.status === 'check' || u.status === 'failed'

/** Clears the list once nothing is left to review. */
export function clearUploads() {
  if (items.some(pending)) return
  items.forEach((u) => u.url && URL.revokeObjectURL(u.url))
  set([])
}

/** Queues image files for reading and opens Review receipts. Files that aren't images are counted, not added. */
export function addFiles(files: Iterable<File>) {
  const all = [...files]
  const images = all.filter((f) => f.type.startsWith('image/'))
  const added = images.map((file): Upload => {
    const id = uid()
    originals.set(id, file)
    return { id, txId: uid(), name: file.name || 'Receipt', status: 'waiting', draft: { type: 'expense', input: '', date: today(), note: '', merchant: '', hints: [] } }
  })
  skipped = all.length - images.length
  if (added.length) { shown = true; set([...items, ...added]) } else emit()
  void pump()
}

// the picked files stay out of the store; they're only needed until the JPEG exists
const originals = new Map<string, File>()
let running = false

/** Reads one receipt at a time; the server allows 10 reads a minute. */
async function pump() {
  if (running) return
  running = true
  try {
    await categoryRepo.load().catch(() => {})
    for (let next = items.find((u) => u.status === 'waiting'); next; next = items.find((u) => u.status === 'waiting')) {
      const { id } = next
      const file = originals.get(id)!
      update(id, { status: 'reading', error: undefined })
      let jpeg: Blob
      try { jpeg = await toJpeg(file) } catch {
        originals.delete(id)
        update(id, { status: 'broken', error: 'Couldn’t open this image. Use a JPG or PNG.' })
        continue
      }
      originals.delete(id)
      update(id, { jpeg, url: URL.createObjectURL(jpeg) })
      for (;;) {
        try {
          const guess = await parse(jpeg, 'image', currencyAtom.get())
          const draft = fromGuess(guess)
          update(id, { draft, status: draft.hints.some((h) => h === 'amount' || h === 'cat' || h === 'date' || h === 'merchant') ? 'check' : 'failed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : ''
          if (/too many requests/i.test(message)) {
            update(id, { status: 'waiting', error: 'Waiting a minute…' })
            await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
            update(id, { status: 'reading', error: undefined })
            continue
          }
          update(id, { status: 'failed', error: message })
        }
        break
      }
    }
  } finally { running = false }
}

/** Same guards as the mobile review sheet: only well-formed guesses are used, each one marked. */
export function fromGuess(g: Guess): Draft {
  const hints: Field[] = []
  const type: TxType = g.type === 'income' || g.type === 'expense' ? g.type : 'expense'
  if (type !== 'expense') hints.push('type')
  let input = ''
  if (g.amount && Number.isSafeInteger(g.amount) && g.amount > 0) { input = amountToInput(g.amount); hints.push('amount') }
  let date = today()
  if (g.date && /^\d{4}-\d{2}-\d{2}$/.test(g.date)) { date = g.date; hints.push('date') }
  let cat: string | undefined
  if (g.category && categories(type).some((c) => c.id === g.category)) { cat = g.category; hints.push('cat') }
  const note = g.note ? g.note.slice(0, 80) : ''
  if (note) hints.push('note')
  const merchant = g.merchant ? g.merchant.slice(0, 80) : ''
  if (merchant) hints.push('merchant')
  return { type, input, date, cat, note, merchant, hints }
}
