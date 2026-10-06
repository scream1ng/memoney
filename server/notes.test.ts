import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { noteRoutes, type NoteStore } from './notes.ts'
import type { Note } from '../src/lib/types.ts'

function setup() {
  const rows = new Map<string, Note & { userId: string }>()
  const store: NoteStore = {
    async list(userId) { return [...rows.values()].filter((n) => n.userId === userId).map(({ id, text, createdAt, updatedAt }) => ({ id, text, createdAt, updatedAt })) },
    async save(userId, note) {
      const current = rows.get(note.id)
      if (current && current.userId !== userId) return false
      rows.set(note.id, { ...note, createdAt: current?.createdAt ?? note.createdAt, userId })
      return true
    },
    async remove(userId, id) { if (rows.get(id)?.userId === userId) rows.delete(id) },
  }
  const app = noteRoutes(store, async (r) => r.headers.get('x-user') ?? undefined)
  const put = (id: string, body: unknown, user = 'a') => app.request(`/${id}`, { method: 'PUT', headers: { 'x-user': user, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const list = async (user = 'a') => (await app.request('/', { headers: { 'x-user': user } })).json() as Promise<Note[]>
  return { app, put, list }
}

const note = { text: '  Trip to Chiang Mai\nBudget 8,000  ', createdAt: 1, updatedAt: 1 }

describe('notes API', () => {
  it('requires a session', async () => {
    const { app } = setup()
    expect((await app.request('/')).status).toBe(401)
    expect((await app.request('/n1', { method: 'DELETE' })).status).toBe(401)
  })

  it('creates, edits and deletes a note for its owner only', async () => {
    const { app, put, list } = setup()
    expect((await put('n1', note)).status).toBe(204)
    expect(await list()).toEqual([{ id: 'n1', text: 'Trip to Chiang Mai\nBudget 8,000', createdAt: 1, updatedAt: 1 }])
    expect(await list('b')).toEqual([])
    expect((await put('n1', { ...note, text: 'Taken', updatedAt: 2 }, 'b')).status).toBe(404)
    expect((await put('n1', { ...note, text: 'Edited', updatedAt: 2 })).status).toBe(204)
    expect((await list())[0].text).toBe('Edited')
    await app.request('/n1', { method: 'DELETE', headers: { 'x-user': 'b' } })
    expect(await list()).toHaveLength(1)
    expect((await app.request('/n1', { method: 'DELETE', headers: { 'x-user': 'a' } })).status).toBe(204)
    expect(await list()).toEqual([])
  })

  it('rejects empty, oversized and malformed notes', async () => {
    const { put } = setup()
    expect((await put('n1', { ...note, text: '   ' })).status).toBe(400)
    expect((await put('n1', { ...note, text: 'x'.repeat(2001) })).status).toBe(400)
    expect((await put('n1', { text: 'ok', createdAt: 'now', updatedAt: 1 })).status).toBe(400)
    expect((await put('x'.repeat(65), note)).status).toBe(400)
  })

  it('serves the client path without a trailing slash', async () => {
    const { app } = setup()
    const mounted = new Hono().route('/api/notes', app)
    expect((await mounted.request('/api/notes', { headers: { 'x-user': 'a' } })).status).toBe(200)
  })

  it('is never cached', async () => {
    const { app } = setup()
    expect((await app.request('/', { headers: { 'x-user': 'a' } })).headers.get('cache-control')).toBe('no-store')
  })
})
