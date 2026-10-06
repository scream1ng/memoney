import { passkey } from '@better-auth/passkey'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import { Hono } from 'hono'
import pg from 'pg'
import type { Tx } from '../src/lib/types.ts'
import { usageSchema, usageRecorder, usageRoutes } from './usage.ts'
import { parseRoutes } from './parse.ts'
import { pgPhotoStore, photoRoutes, photoSchema } from './photos.ts'
import { categoryRoutes, categorySchema, pgCategoryStore, saveCategorizedTransaction } from './categories.ts'
import { noteRoutes, notesSchema, pgNoteStore } from './notes.ts'

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

await db.query(usageSchema)
await db.query(photoSchema)
await db.query(categorySchema)
await db.query(notesSchema)

const categoryStore = pgCategoryStore(db)

type Vars = { Variables: { userId: string } }
const app = new Hono<Vars>()

app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

app.route('/api/parse', parseRoutes(async (request) => {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user.id
}, new URL(baseURL).origin, usageRecorder(db), (userId) => categoryStore.list(userId)))

app.route('/api/categories', categoryRoutes(categoryStore, async (request) => {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user.id
}))

app.route('/api/notes', noteRoutes(pgNoteStore(db), async (request) => {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user.id
}))

app.route('/api/usage', usageRoutes(db, async (request) => {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user
}))

app.use('/api/tx/*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('userId', session.user.id)
  await next()
})

const COLS = `id, type, amount, category, date, note, merchant, created_at as "createdAt",
  (select a.created_at from attachments a where a.tx_id = transactions.id) as "photoAt"`

app.get('/api/tx/', async (c) => {
  const { rows } = await db.query(`select ${COLS} from transactions where user_id = $1`, [c.get('userId')])
  return c.json(rows.map((r) => ({ ...r, note: r.note ?? undefined, merchant: r.merchant ?? undefined, photoAt: r.photoAt ?? undefined })))
})

app.route('/api/tx', photoRoutes(pgPhotoStore(db), async (request) => {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user.id
}))

app.put('/api/tx/:id', async (c) => {
  const t = (await c.req.json()) as Tx
  const ok =
    (t.type === 'expense' || t.type === 'income') &&
    Number.isSafeInteger(t.amount) && t.amount > 0 &&
    typeof t.category === 'string' && t.category.length > 0 && t.category.length <= 40 && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    Number.isSafeInteger(t.createdAt)
  if (!ok) return c.json({ error: 'invalid' }, 400)
  const saved = await saveCategorizedTransaction(db, c.get('userId'), c.req.param('id'), t)
  if (!saved) return c.json({ error: 'unknown category' }, 400)
  return c.body(null, 204)
})

app.delete('/api/tx/:id', async (c) => {
  await db.query('delete from transactions where id = $1 and user_id = $2', [c.req.param('id'), c.get('userId')])
  return c.body(null, 204)
})

app.use('/*', serveStatic({ root: './dist' }))

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, () => console.log(`[server] :${port}`))
