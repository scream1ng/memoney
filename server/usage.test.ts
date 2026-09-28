import { describe, expect, it, vi } from 'vitest'
import type pg from 'pg'
import { estimate, periodRange, usageRecorder, usageRoutes } from './usage.ts'

const member = { id: 'member', email: 'member@example.com', emailVerified: true }
const admin = { id: 'admin', email: 'imbaoak@gmail.com', emailVerified: true }
const mockDb = () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) })
const pool = (db: ReturnType<typeof mockDb>) => db as unknown as Pick<pg.Pool, 'query'>

describe('usage billing', () => {
  it('prices cached and written tokens separately without adding reasoning twice', () => {
    expect(estimate('gpt-6-luna', { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 }, output_tokens_details: { reasoning_tokens: 80 } })?.nano).toBe(134500)
  })
  it('uses long-context pricing and transcription pricing', () => {
    expect(estimate('gpt-6-luna', { input_tokens: 300000, output_tokens: 1000 })?.nano).toBe(60_750_000)
    expect(estimate('gpt-4o-mini-transcribe', { input_tokens: 1000, output_tokens: 100 })?.nano).toBe(1_750_000)
  })
  it('keeps missing, invalid and unknown-model costs unavailable', () => {
    expect(estimate('gpt-6-luna', undefined)).toBeNull()
    expect(estimate('other', { input_tokens: 10, output_tokens: 10 })).toBeNull()
    expect(estimate('gpt-6-luna', { input_tokens: 10, output_tokens: -1 })).toBeNull()
    expect(estimate('gpt-6-luna', { input_tokens: 10, output_tokens: 1, input_tokens_details: { cached_tokens: 11 } })).toBeNull()
  })
  it('records before a call and stores only counters and a price snapshot', async () => {
    const db = mockDb()
    const finish = await usageRecorder(pool(db))('member', 'audio', 'gpt-4o-mini-transcribe')
    expect(db.query.mock.calls[0][1].slice(1)).toEqual(['member', 'audio', 'gpt-4o-mini-transcribe'])
    await finish({ input_tokens: 10, output_tokens: 2, transcript: 'private' }, 'completed')
    expect(JSON.stringify(db.query.mock.calls)).not.toContain('private')
    expect(db.query.mock.calls[1][1][3]).toBe(22500)
  })
})

describe('usage access and periods', () => {
  it('rejects signed-out, non-admin and unverified admin requests without querying', async () => {
    const db = mockDb()
    for (const [user, status] of [[undefined, 401], [member, 403], [{ ...admin, emailVerified: false }, 403]] as const) {
      expect((await usageRoutes(pool(db), async () => user).request('/admin')).status).toBe(status)
    }
    expect(db.query).not.toHaveBeenCalled()
  })
  it('always limits personal reports to the session user, ignoring supplied IDs', async () => {
    const db = mockDb()
    const r = await usageRoutes(pool(db), async () => member).request('/me?userId=admin')
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(db.query.mock.calls[0][1][2]).toBe('member')
  })
  it('allows verified admin aggregation and converts nanodollars', async () => {
    const db = mockDb()
    db.query.mockResolvedValue({ rows: [{ id: 'member', nano: '1000000' }] })
    const r = await usageRoutes(pool(db), async () => admin).request('/admin?period=week')
    expect((await r.json() as { accounts: { usd: number }[] }).accounts[0].usd).toBe(0.001)
    expect(db.query.mock.calls[0][1][2]).toBeNull()
  })
  it('rejects invalid ranges before querying', async () => {
    const db = mockDb()
    const app = usageRoutes(pool(db), async () => admin)
    for (const query of ['offset=1', 'offset=-121', 'offset=NaN', 'period=year', 'offset=0.5']) expect((await app.request(`/admin?${query}`)).status).toBe(400)
    expect(db.query).not.toHaveBeenCalled()
  })
  it('uses Melbourne calendar boundaries, Monday weeks, leap years and year rollover', () => {
    expect(periodRange('month', 0, new Date('2026-09-30T15:00:00Z'))).toEqual({ start: '2026-10-01', end: '2026-11-01' })
    expect(periodRange('week', 0, new Date('2026-10-04T14:00:00Z'))).toEqual({ start: '2026-10-05', end: '2026-10-12' })
    expect(periodRange('month', -1, new Date('2024-03-15Z'))).toEqual({ start: '2024-02-01', end: '2024-03-01' })
    expect(periodRange('month', -1, new Date('2026-01-15Z'))).toEqual({ start: '2025-12-01', end: '2026-01-01' })
  })
})
