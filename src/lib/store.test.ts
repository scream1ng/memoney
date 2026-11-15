import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Tx } from './types'

const tx: Tx = { id: 'draft-1', date: '2026-10-01', type: 'expense', amount: 1234, category: 'food', note: 'Keep this draft', createdAt: 1 }

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() })
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

it('publishes a saved entry only after the server confirms it', async () => {
  const { repo } = await import('./store')
  let respond!: (response: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { respond = resolve }))
  const saving = repo.save(tx)
  expect(repo.list()).toEqual([])
  respond(new Response('{}'))
  await saving
  expect(repo.list()).toEqual([tx])
})

it('retains existing data when saving fails, and allows retry with the same draft id', async () => {
  const { repo } = await import('./store')
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([tx])))
  await repo.load()
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))
  await expect(repo.save({ ...tx, note: 'Edited draft' })).rejects.toThrow()
  expect(repo.list()).toEqual([tx])
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}'))
  await repo.save({ ...tx, note: 'Edited draft' })
  expect(repo.list()).toEqual([{ ...tx, note: 'Edited draft' }])
})

it('keeps an entry visible after deletion fails and removes it after a successful retry', async () => {
  const { repo } = await import('./store')
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([tx])))
  await repo.load()
  vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline'))
  await expect(repo.remove(tx.id)).rejects.toThrow('Offline')
  expect(repo.list()).toEqual([tx])
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}'))
  await repo.remove(tx.id)
  expect(repo.list()).toEqual([])
})

it('surfaces a receipt failure and does not create duplicate cache entries on retry', async () => {
  const { repo } = await import('./store')
  const photo = new Blob(['receipt'], { type: 'image/jpeg' })
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(null, { status: 500 }))
  await expect(repo.save(tx, photo)).rejects.toThrow()
  expect(repo.list()).toEqual([])
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('{"photoAt":2}'))
  await repo.save(tx, photo)
  expect(repo.list()).toEqual([{ ...tx, photoAt: 2 }])
})

it('shares the chosen period and week across screen consumers without storing stale preferences', async () => {
  const { periodAtom, weekAtom } = await import('./store')
  periodAtom.set('week')
  weekAtom.set('2026-09-28')
  const stats = await import('./store')
  expect(stats.periodAtom.get()).toBe('week')
  expect(stats.weekAtom.get()).toBe('2026-09-28')
  expect(localStorage.setItem).not.toHaveBeenCalled()
})

const offline = () => vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
const calls = () => vi.mocked(fetch).mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`)

it('keeps an entry saved with no connection on this phone and sends it on the next load', async () => {
  const { repo } = await import('./store')
  offline()
  await repo.save(tx)
  expect(repo.list()).toEqual([tx])
  expect(repo.outbox()).toEqual({ [tx.id]: { op: 'put', tx } })
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(JSON.stringify([tx])))
  await repo.load()
  expect(calls()).toEqual(['PUT /api/tx/draft-1', 'PUT /api/tx/draft-1', 'GET /api/tx/'])
  expect(repo.outbox()).toEqual({})
  expect(repo.list()).toEqual([tx])
})

it('does not queue an entry with a photo; the error reaches the sheet', async () => {
  const { repo, isOffline } = await import('./store')
  offline()
  const err = await repo.save(tx, new Blob(['receipt'], { type: 'image/jpeg' })).catch((e: unknown) => e)
  expect(isOffline(err)).toBe(true)
  expect(repo.list()).toEqual([])
  expect(repo.outbox()).toEqual({})
})

it('does not queue a save the server refused', async () => {
  const { repo } = await import('./store')
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 400 }))
  await expect(repo.save(tx)).rejects.toThrow('400')
  expect(repo.outbox()).toEqual({})
})

it('marks a waiting entry the server later refuses, keeps it, and stops at the first offline failure', async () => {
  const { repo } = await import('./store')
  const other = { ...tx, id: 'draft-2' }
  offline(); await repo.save(tx)
  offline(); await repo.save(other)
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 400 }))
  offline()
  await repo.flush()
  expect(repo.outbox()).toEqual({ [tx.id]: { op: 'put', tx, failed: true }, [other.id]: { op: 'put', tx: other } })
  expect(repo.list()).toEqual([tx, other])
  // fixing it from the sheet sends it straight away and clears the mark
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
  await repo.save({ ...tx, category: 'transport' })
  expect(repo.outbox()).toEqual({ [other.id]: { op: 'put', tx: other } })
})

it('hides an entry deleted with no connection and sends the delete later', async () => {
  const { repo } = await import('./store')
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([tx])))
  await repo.load()
  offline()
  await repo.remove(tx.id)
  expect(repo.list()).toEqual([])
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response('[]'))
  await repo.load()
  expect(calls().slice(-2)).toEqual(['DELETE /api/tx/draft-1', 'GET /api/tx/'])
  expect(repo.outbox()).toEqual({})
  expect(repo.list()).toEqual([])
})

it('deleting an entry that never reached the server just drops it', async () => {
  const { repo } = await import('./store')
  offline()
  await repo.save(tx)
  vi.mocked(fetch).mockClear()
  await repo.remove(tx.id)
  expect(fetch).not.toHaveBeenCalled()
  expect(repo.list()).toEqual([])
  expect(repo.outbox()).toEqual({})
})

it('keeps waiting entries across a restart, before the account is confirmed', async () => {
  const store = new Map<string, string>([
    ['memoney.active', `s1 ${Date.now()}`],
    ['memoney.cache', JSON.stringify({ user: 'u1', tx: [] })],
  ])
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) })
  const first = await import('./store')
  offline()
  await first.repo.save(tx)
  expect(JSON.parse(store.get('memoney.cache')!)).toMatchObject({ user: 'u1', outbox: { [tx.id]: { op: 'put', tx } } })
  vi.resetModules()
  const second = await import('./store')
  expect(second.repo.list()).toEqual([tx])
})

it('leaves a waiting entry unmarked when the server is down, and retries later', async () => {
  const { repo } = await import('./store')
  offline()
  await repo.save(tx)
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 502 }))
  await repo.flush()
  expect(repo.outbox()).toEqual({ [tx.id]: { op: 'put', tx } })
})

it('lets a waiting older copy land before sending a newer save of the same entry', async () => {
  const { repo } = await import('./store')
  offline()
  await repo.save(tx)
  let land!: (r: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { land = resolve }))
  const syncing = repo.flush()
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
  const saving = repo.save({ ...tx, note: 'newer' })
  await Promise.resolve()
  land(new Response(null, { status: 204 }))
  await Promise.all([syncing, saving])
  const bodies = vi.mocked(fetch).mock.calls.slice(1).map(([, init]) => JSON.parse(String(init?.body)).note)
  expect(bodies).toEqual(['Keep this draft', 'newer'])
  expect(repo.list()).toEqual([{ ...tx, note: 'newer' }])
})

it('a delete made while that entry is being sent goes after it, so the entry stays deleted', async () => {
  const { repo } = await import('./store')
  offline()
  await repo.save(tx)
  let land!: (r: Response) => void
  vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { land = resolve }))
  const syncing = repo.flush()
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
  const removing = repo.remove(tx.id)
  await Promise.resolve()
  land(new Response(null, { status: 204 }))
  await Promise.all([syncing, removing])
  expect(calls().slice(-1)).toEqual(['DELETE /api/tx/draft-1'])
  expect(repo.list()).toEqual([])
  expect(repo.outbox()).toEqual({})
})

it('treats a signed-out reply as try-again-later, and a delete of an already-gone entry as done', async () => {
  const { repo } = await import('./store')
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([tx])))
  await repo.load()
  offline(); await repo.remove(tx.id)
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }))
  await repo.flush()
  expect(repo.outbox()).toEqual({ [tx.id]: { op: 'delete' } })
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }))
  await repo.flush()
  expect(repo.outbox()).toEqual({})
  expect(repo.list()).toEqual([])
})
