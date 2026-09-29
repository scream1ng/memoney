import { Hono } from 'hono'
import type pg from 'pg'
import { ACTIVE_CATEGORIES, CATEGORIES, COLORS, ICONS } from '../src/lib/categories.ts'
import type { CustomCategory, Tx, TxType } from '../src/lib/types.ts'

type Input = Omit<CustomCategory, 'id'>
type SaveResult = CustomCategory | 'missing' | 'duplicate'

export const categorySchema = `
  create table if not exists user_categories (
    id text primary key,
    user_id text not null references "user"(id) on delete cascade,
    type text not null check (type in ('expense', 'income')),
    label text not null check (length(label) between 1 and 40),
    icon text not null,
    color text not null,
    clues text not null default '',
    created_at bigint not null
  );
  create unique index if not exists user_categories_name on user_categories(user_id, type, lower(label));
  create index if not exists user_categories_user_time on user_categories(user_id, created_at);
`

export interface CategoryStore {
  list(userId: string): Promise<CustomCategory[]>
  create(userId: string, input: Input): Promise<SaveResult>
  update(userId: string, id: string, input: Input): Promise<SaveResult>
  remove(userId: string, id: string): Promise<'ok' | 'missing' | 'used'>
}

const duplicate = (e: unknown) => (e as { code?: string })?.code === '23505'

export async function saveCategorizedTransaction(db: pg.Pool, userId: string, id: string, tx: Tx): Promise<boolean> {
  const sql = `insert into transactions (id, user_id, type, amount, category, date, note, merchant, created_at)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    on conflict (id) do update set type = $3, amount = $4, category = $5, date = $6, note = $7, merchant = $8
    where transactions.user_id = $2`
  const values = [id, userId, tx.type, tx.amount, tx.category, tx.date,
    tx.note?.slice(0, 80) ?? null, tx.merchant?.slice(0, 80) ?? null, tx.createdAt]
  if (CATEGORIES[tx.type].some((cat) => cat.id === tx.category)) {
    await db.query(sql, values)
    return true
  }
  const client = await db.connect()
  try {
    await client.query('begin')
    // Hold the category row until the transaction is saved; deletion takes the conflicting lock.
    const { rowCount } = await client.query(
      'select 1 from user_categories where id=$1 and user_id=$2 and type=$3 for key share',
      [tx.category, userId, tx.type],
    )
    if (!rowCount) { await client.query('rollback'); return false }
    await client.query(sql, values)
    await client.query('commit')
    return true
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally { client.release() }
}

export function pgCategoryStore(db: pg.Pool): CategoryStore {
  return {
    async list(userId) {
      const { rows } = await db.query('select id, type, label, icon, color, clues from user_categories where user_id = $1 order by created_at, id', [userId])
      return rows as CustomCategory[]
    },
    async create(userId, input) {
      const id = crypto.randomUUID()
      try {
        const { rows } = await db.query(
          `insert into user_categories (id, user_id, type, label, icon, color, clues, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, type, label, icon, color, clues`,
          [id, userId, input.type, input.label, input.icon, input.color, input.clues, Date.now()],
        )
        return rows[0] as CustomCategory
      } catch (e) { if (duplicate(e)) return 'duplicate'; throw e }
    },
    async update(userId, id, input) {
      try {
        const { rows } = await db.query(
          `update user_categories set label=$4, icon=$5, color=$6, clues=$7
           where id=$1 and user_id=$2 and type=$3 returning id, type, label, icon, color, clues`,
          [id, userId, input.type, input.label, input.icon, input.color, input.clues],
        )
        return rows[0] as CustomCategory | undefined ?? 'missing'
      } catch (e) { if (duplicate(e)) return 'duplicate'; throw e }
    },
    async remove(userId, id) {
      const client = await db.connect()
      try {
        await client.query('begin')
        // Wait for in-flight saves before checking whether the category is used.
        const { rowCount } = await client.query('select 1 from user_categories where id=$1 and user_id=$2 for update', [id, userId])
        if (!rowCount) { await client.query('rollback'); return 'missing' }
        const used = await client.query('select 1 from transactions where user_id=$1 and category=$2 limit 1', [userId, id])
        if (used.rowCount) { await client.query('rollback'); return 'used' }
        await client.query('delete from user_categories where id=$1 and user_id=$2', [id, userId])
        await client.query('commit')
        return 'ok'
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally { client.release() }
    },
  }
}

function input(value: unknown): Input | undefined {
  if (!value || typeof value !== 'object') return
  const v = value as Record<string, unknown>
  if (v.type !== 'income' && v.type !== 'expense') return
  if (typeof v.label !== 'string' || !v.label.trim() || v.label.trim().length > 40) return
  if (typeof v.icon !== 'string' || !Object.hasOwn(ICONS, v.icon)) return
  if (typeof v.color !== 'string' || !COLORS.includes(v.color)) return
  if (typeof v.clues !== 'string' || v.clues.trim().length > 200) return
  return { type: v.type as TxType, label: v.label.trim(), icon: v.icon, color: v.color, clues: v.clues.trim() }
}

export function categoryRoutes(store: CategoryStore, getUserId: (r: Request) => Promise<string | undefined>) {
  const app = new Hono<{ Variables: { userId: string } }>()
  app.use('*', async (c, next) => {
    const userId = await getUserId(c.req.raw)
    if (!userId) return c.json({ error: 'Please sign in again.' }, 401)
    c.set('userId', userId)
    c.header('Cache-Control', 'no-store')
    await next()
  })
  app.get('/', async (c) => c.json(await store.list(c.get('userId'))))
  app.post('/', async (c) => {
    const data = input(await c.req.json().catch(() => undefined))
    if (!data) return c.json({ error: 'Invalid category.' }, 400)
    const existing = await store.list(c.get('userId'))
    if (existing.length >= 50) return c.json({ error: 'Category limit reached.' }, 400)
    if ([...existing.filter((x) => x.type === data.type), ...ACTIVE_CATEGORIES[data.type]].some((x) => x.label.toLowerCase() === data.label.toLowerCase()))
      return c.json({ error: 'This category name already exists.' }, 409)
    const result = await store.create(c.get('userId'), data)
    return result === 'duplicate' ? c.json({ error: 'This category name already exists.' }, 409) : c.json(result, 201)
  })
  app.put('/:id', async (c) => {
    const data = input(await c.req.json().catch(() => undefined))
    if (!data) return c.json({ error: 'Invalid category.' }, 400)
    if (ACTIVE_CATEGORIES[data.type].some((x) => x.label.toLowerCase() === data.label.toLowerCase())) return c.json({ error: 'This category name already exists.' }, 409)
    const result = await store.update(c.get('userId'), c.req.param('id'), data)
    if (result === 'missing') return c.json({ error: 'Category not found.' }, 404)
    if (result === 'duplicate') return c.json({ error: 'This category name already exists.' }, 409)
    return c.json(result)
  })
  app.delete('/:id', async (c) => {
    const result = await store.remove(c.get('userId'), c.req.param('id'))
    if (result === 'missing') return c.json({ error: 'Category not found.' }, 404)
    if (result === 'used') return c.json({ error: 'Move entries to another category before deleting this one.' }, 409)
    return c.body(null, 204)
  })
  return app
}
