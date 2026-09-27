import { passkey } from '@better-auth/passkey'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import { Hono } from 'hono'
import pg from 'pg'
import type { Tx } from '../src/lib/types.ts'

pg.types.setTypeParser(20, Number) // bigint → number
pg.types.setTypeParser(1082, (v) => v) // date → 'YYYY-MM-DD'

const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`missing env ${k}`)
  return v
}

const baseURL = env('BETTER_AUTH_URL')
const db = new pg.Pool({ connectionString: env('DATABASE_URL') })

const auth = betterAuth({
  appName: 'MeMoney',
  baseURL,
  database: db,
  socialProviders: {
    google: { clientId: env('GOOGLE_CLIENT_ID'), clientSecret: env('GOOGLE_CLIENT_SECRET') },
  },
  plugins: [passkey({ rpID: new URL(baseURL).hostname, rpName: 'MeMoney', origin: baseURL })],
})

// auth tables (user, session, account, verification, passkey) + ours
await (await getMigrations(auth.options)).runMigrations()
await db.query(`
  create table if not exists transactions (
    id text primary key,
    user_id text not null references "user"(id) on delete cascade,
    type text not null check (type in ('expense', 'income')),
    amount bigint not null check (amount > 0),
    category text not null,
    date date not null,
    note text,
    merchant text,
    created_at bigint not null
  );
  create index if not exists transactions_user_date on transactions (user_id, date desc);
`)

type Vars = { Variables: { userId: string } }
const app = new Hono<Vars>()

app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

app.use('/api/tx/*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', session.user.id)
  await next()
})

const COLS = `id, type, amount, category, date, note, merchant, created_at as "createdAt"`

app.get('/api/tx/', async (c) => {
  const { rows } = await db.query(`select ${COLS} from transactions where user_id = $1`, [c.get('userId')])
  return c.json(rows.map((r) => ({ ...r, note: r.note ?? undefined, merchant: r.merchant ?? undefined })))
})

app.put('/api/tx/:id', async (c) => {
  const t = (await c.req.json()) as Tx
  const ok =
    (t.type === 'expense' || t.type === 'income') &&
    Number.isSafeInteger(t.amount) && t.amount > 0 &&
    typeof t.category === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    Number.isSafeInteger(t.createdAt)
  if (!ok) return c.json({ error: 'invalid' }, 400)
  // "where" stops one user overwriting another user's row by id
  await db.query(
    `insert into transactions (id, user_id, type, amount, category, date, note, merchant, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (id) do update set type = $3, amount = $4, category = $5, date = $6, note = $7, merchant = $8
     where transactions.user_id = $2`,
    [c.req.param('id'), c.get('userId'), t.type, t.amount, t.category.slice(0, 40), t.date,
      t.note?.slice(0, 80) ?? null, t.merchant?.slice(0, 80) ?? null, t.createdAt],
  )
  return c.body(null, 204)
})

app.delete('/api/tx/:id', async (c) => {
  await db.query('delete from transactions where id = $1 and user_id = $2', [c.req.param('id'), c.get('userId')])
  return c.body(null, 204)
})

app.use('/*', serveStatic({ root: './dist' }))

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, () => console.log(`[server] :${port}`))
