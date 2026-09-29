import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { categoryRoutes, type CategoryStore } from './categories.ts'
import type { CustomCategory } from '../src/lib/types.ts'

function setup() {
  const data = new Map<string, CustomCategory[]>()
  const store: CategoryStore = {
    async list(userId) { return data.get(userId) ?? [] },
    async create(userId, input) {
      const item = { id: `custom-${(data.get(userId)?.length ?? 0) + 1}`, ...input }
      data.set(userId, [...data.get(userId) ?? [], item])
      return item
    },
    async update(userId, id, input) {
      const items = data.get(userId) ?? []
      if (!items.some((c) => c.id === id && c.type === input.type)) return 'missing'
      const item = { id, ...input }
      data.set(userId, items.map((c) => c.id === id ? item : c))
      return item
    },
    async remove(userId, id) {
      const items = data.get(userId) ?? []
      if (!items.some((c) => c.id === id)) return 'missing'
      data.set(userId, items.filter((c) => c.id !== id))
      return 'ok'
    },
  }
  const app = categoryRoutes(store, async (r) => r.headers.get('x-user') ?? undefined)
  const post = (body: unknown, user = 'a') => app.request('/', { method: 'POST', headers: { 'x-user': user, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { app, post }
}

const income = { type: 'income', label: 'Salary · B', icon: 'briefcase', color: '#248a3d', clues: 'B Payroll' }

describe('custom category API', () => {
  it('serves the client path without a trailing slash', async () => {
    const { app } = setup()
    const mounted = new Hono().route('/api/categories', app)
    expect((await mounted.request('/api/categories', { headers: { 'x-user': 'a' } })).status).toBe(200)
    expect((await mounted.request('/api/categories/', { headers: { 'x-user': 'a' } })).status).toBe(404)
  })

  it('stores distinct salary sources for their owner', async () => {
    const { app, post } = setup()
    expect((await post({ ...income, label: 'Salary · A', clues: 'A Payroll' })).status).toBe(201)
    expect((await post(income)).status).toBe(201)
    const own = await (await app.request('/', { headers: { 'x-user': 'a' } })).json() as CustomCategory[]
    expect(own.map((c) => [c.label, c.clues])).toEqual([['Salary · A', 'A Payroll'], ['Salary · B', 'B Payroll']])
    expect(await (await app.request('/', { headers: { 'x-user': 'b' } })).json()).toEqual([])
    expect((await app.request('/')).status).toBe(401)
  })

  it('rejects invalid metadata and duplicate category names', async () => {
    const { post } = setup()
    expect((await post({ ...income, icon: 'unknown' })).status).toBe(400)
    expect((await post({ ...income, color: '#123456' })).status).toBe(400)
    expect((await post({ ...income, label: 'Salary' })).status).toBe(409)
    expect((await post(income)).status).toBe(201)
    expect((await post({ ...income, label: 'salary · b' })).status).toBe(409)
  })

  it('cannot edit or delete another user’s category', async () => {
    const { app, post } = setup()
    const created = await (await post(income)).json() as CustomCategory
    const headers = { 'x-user': 'b', 'content-type': 'application/json' }
    expect((await app.request(`/${created.id}`, { method: 'PUT', headers, body: JSON.stringify(income) })).status).toBe(404)
    expect((await app.request(`/${created.id}`, { method: 'DELETE', headers })).status).toBe(404)
  })
})
