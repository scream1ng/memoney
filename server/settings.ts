import { Hono } from 'hono'
import type pg from 'pg'
import { CATEGORIES } from '../src/lib/categories.ts'
import { CURRENCIES } from '../src/lib/currencies.ts'

/** Per-account preferences: the currency symbol and monthly spending limits per expense category. */
export const settingsSchema = `
  create table if not exists user_settings (
    user_id text primary key references "user"(id) on delete cascade,
    currency text not null default ''
  );
  create table if not exists budgets (
    user_id text not null references "user"(id) on delete cascade,
    category text not null,
    amount bigint not null check (amount > 0),
    primary key (user_id, category)
  );
`

/** Largest limit the keypad allows: 9 whole digits, in minor units. */
export const MAX_BUDGET = 999_999_999_99

export interface Settings {
  /** null until the account has saved one; the phone then uploads its local choice */
  currency: string | null
  /** category id → monthly limit in minor units */
  budgets: Record<string, number>
}

export interface SettingsStore {
  get(userId: string): Promise<Settings>
  setCurrency(userId: string, currency: string): Promise<void>
  /** false when the category isn't one of the account's expense categories */
  setBudget(userId: string, category: string, amount: number): Promise<boolean>
  removeBudget(userId: string, category: string): Promise<void>
}

export function pgSettingsStore(db: Pick<pg.Pool, 'query'>): SettingsStore {
  return {
    async get(userId) {
      const [s, b] = await Promise.all([
        db.query('select currency from user_settings where user_id = $1', [userId]),
        db.query('select category, amount from budgets where user_id = $1', [userId]),
      ])
      return {
        currency: s.rows[0]?.currency ?? null,
        budgets: Object.fromEntries(b.rows.map((r) => [r.category, Number(r.amount)])),
      }
    },
    async setCurrency(userId, currency) {
      await db.query(`insert into user_settings (user_id, currency) values ($1, $2)
        on conflict (user_id) do update set currency = $2`, [userId, currency])
    },
    async setBudget(userId, category, amount) {
      if (!CATEGORIES.expense.some((c) => c.id === category)) {
        const { rowCount } = await db.query(
          `select 1 from user_categories where id = $1 and user_id = $2 and type = 'expense'`, [category, userId])
        if (!rowCount) return false
      }
      await db.query(`insert into budgets (user_id, category, amount) values ($1, $2, $3)
        on conflict (user_id, category) do update set amount = $3`, [userId, category, amount])
      return true
    },
    async removeBudget(userId, category) {
      await db.query('delete from budgets where user_id = $1 and category = $2', [userId, category])
    },
  }
}

export function settingsRoutes(store: SettingsStore, getUserId: (r: Request) => Promise<string | undefined>) {
  const app = new Hono<{ Variables: { userId: string } }>()
  app.use('*', async (c, next) => {
    const userId = await getUserId(c.req.raw)
    if (!userId) return c.json({ error: 'Please sign in again.' }, 401)
    c.set('userId', userId)
    c.header('Cache-Control', 'no-store')
    await next()
  })
  app.get('/', async (c) => c.json(await store.get(c.get('userId'))))
  app.put('/currency', async (c) => {
    const { currency } = (await c.req.json().catch(() => ({}))) as { currency?: unknown }
    if (typeof currency !== 'string' || !CURRENCIES.includes(currency)) return c.json({ error: 'Invalid currency.' }, 400)
    await store.setCurrency(c.get('userId'), currency)
    return c.body(null, 204)
  })
  app.put('/budgets/:category', async (c) => {
    const { amount } = (await c.req.json().catch(() => ({}))) as { amount?: unknown }
    if (!Number.isSafeInteger(amount) || (amount as number) <= 0 || (amount as number) > MAX_BUDGET) return c.json({ error: 'Invalid limit.' }, 400)
    if (!await store.setBudget(c.get('userId'), c.req.param('category'), amount as number)) return c.json({ error: 'Category not found.' }, 404)
    return c.body(null, 204)
  })
  app.delete('/budgets/:category', async (c) => {
    await store.removeBudget(c.get('userId'), c.req.param('category'))
    return c.body(null, 204)
  })
  return app
}
