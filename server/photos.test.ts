import { describe, expect, it, vi } from 'vitest'
import type pg from 'pg'
import { pgPhotoStore, photoRoutes } from './photos.ts'

const mockDb = (result: object = { rows: [], rowCount: 1 }) => ({ query: vi.fn().mockResolvedValue(result) })
const pool = (db: ReturnType<typeof mockDb>) => db as unknown as Pick<pg.Pool, 'query'>
const routes = (db: ReturnType<typeof mockDb>, signedIn = true) => photoRoutes(pgPhotoStore(pool(db)), async () => (signedIn ? 'u1' : undefined))
const jpeg = (body: string | Uint8Array<ArrayBuffer>, type = 'image/jpeg') => ({ method: 'PUT', headers: { 'content-type': type }, body })

describe('receipt photos', () => {
  it('rejects signed-out requests without querying', async () => {
    const db = mockDb()
    for (const method of ['GET', 'PUT', 'DELETE']) {
      expect((await routes(db, false).request('/t1/photo', { method })).status).toBe(401)
    }
    expect(db.query).not.toHaveBeenCalled()
  })
  it('stores only JPEG, never SVG or other types', async () => {
    const db = mockDb()
    expect((await routes(db).request('/t1/photo', jpeg('<svg onload="x()"/>', 'image/svg+xml'))).status).toBe(415)
    expect((await routes(db).request('/t1/photo', jpeg('x', 'image/png'))).status).toBe(415)
    expect(db.query).not.toHaveBeenCalled()
  })
  it('rejects photos over 3 MB', async () => {
    const db = mockDb()
    expect((await routes(db).request('/t1/photo', jpeg(new Uint8Array(3 * 1024 * 1024 + 1)))).status).toBe(413)
    expect(db.query).not.toHaveBeenCalled()
  })
  it('404s when the transaction is not the user’s', async () => {
    const db = mockDb({ rows: [], rowCount: 0 })
    expect((await routes(db).request('/t1/photo', jpeg(new Uint8Array([1, 2])))).status).toBe(404)
  })
  it('saves a JPEG scoped to the user and returns its version', async () => {
    const db = mockDb()
    const res = await routes(db).request('/t1/photo', jpeg(new Uint8Array([1, 2])))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { photoAt: number }).photoAt).toBe(db.query.mock.calls[0][1][3])
    expect(db.query.mock.calls[0][1].slice(0, 2)).toEqual(['t1', 'u1'])
  })
  it('reads and deletes only the user’s photo, served as nosniff JPEG', async () => {
    const db = mockDb({ rows: [{ bytes: Buffer.from([9]) }] })
    const res = await routes(db).request('/t1/photo')
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([9]))
    await routes(db).request('/t1/photo', { method: 'DELETE' })
    for (const [sql, args] of db.query.mock.calls) {
      expect(sql).toContain('user_id = $2')
      expect(args).toEqual(['t1', 'u1'])
    }
  })
  it('404s when there is no photo', async () => {
    expect((await routes(mockDb({ rows: [] })).request('/t1/photo')).status).toBe(404)
  })
})
