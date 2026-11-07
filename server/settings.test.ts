import { describe, expect, it } from 'vitest'
import { settingsRoutes, type SettingsStore } from './settings.ts'

function setup() {
  const currency = new Map<string, string>()
  const budgets = new Map<string, Map<string, number>>()
  const store: SettingsStore = {
    async get(userId) { return { currency: currency.get(userId) ?? null, budgets: Object.fromEntries(budgets.get(userId) ?? []) } },
    async setCurrency(userId, c) { currency.set(userId, c) },
    async setBudget(userId, category, amount) {
      if (!['food', 'mine'].includes(category)) return false
      if (!budgets.has(userId)) budgets.set(userId, new Map())
      budgets.get(userId)!.set(category, amount)
      return true
    },
    async removeBudget(userId, category) { budgets.get(userId)?.delete(category) },
  }
  const app = settingsRoutes(store, async (r) => r.headers.get('x-user') ?? undefined)
  const send = (method: string, path: string, body?: unknown, user = 'a') =>
    app.request(path, { method, headers: { 'x-user': user, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const get = async (user = 'a') => (await app.request('/', { headers: { 'x-user': user } })).json() as Promise<{ currency: string | null; budgets: Record<string, number> }>
  return { app, send, get }
}

describe('settings API', () => {
  it('requires a session', async () => {
    const { app } = setup()
    expect((await app.request('/')).status).toBe(401)
    expect((await app.request('/budgets/food', { method: 'PUT' })).status).toBe(401)
  })

  it('starts empty, so the phone knows to upload its local currency', async () => {
    expect(await setup().get()).toEqual({ currency: null, budgets: {} })
  })

  it('saves a known currency per account and rejects anything else', async () => {
    const { send, get } = setup()
    expect((await send('PUT', '/currency', { currency: '฿' })).status).toBe(204)
    expect((await send('PUT', '/currency', { currency: '' })).status).toBe(204) // "None"
    expect((await send('PUT', '/currency', { currency: 'BTC' })).status).toBe(400)
    expect((await send('PUT', '/currency', {})).status).toBe(400)
    expect((await get()).currency).toBe('')
    expect((await get('b')).currency).toBeNull()
  })

  it('sets, replaces and removes a monthly limit', async () => {
    const { send, get } = setup()
    expect((await send('PUT', '/budgets/food', { amount: 600_000 })).status).toBe(204)
    expect((await send('PUT', '/budgets/food', { amount: 500_000 })).status).toBe(204)
    expect((await get()).budgets).toEqual({ food: 500_000 })
    expect((await get('b')).budgets).toEqual({})
    expect((await send('DELETE', '/budgets/food')).status).toBe(204)
    expect((await get()).budgets).toEqual({})
  })

  it('rejects bad amounts and unknown categories', async () => {
    const { send } = setup()
    for (const amount of [0, -5, 1.5, '100', 1e15, undefined]) expect((await send('PUT', '/budgets/food', { amount })).status).toBe(400)
    expect((await send('PUT', '/budgets/salary', { amount: 100 })).status).toBe(404)
  })
})
