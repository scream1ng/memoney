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
