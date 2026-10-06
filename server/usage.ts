import { Hono } from 'hono'
import type pg from 'pg'

import { isAdmin } from '../src/lib/access.ts'

// USD per million tokens, Standard pricing checked 2026-09-28.
// https://developers.openai.com/api/docs/pricing
export function estimate(model: string, raw: unknown) {
  const u = raw as { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } } | undefined
  const input = u?.input_tokens, output = u?.output_tokens
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(output) || input! < 0 || output! < 0) return null
  const cached = u?.input_tokens_details?.cached_tokens ?? 0
  const write = u?.input_tokens_details?.cache_write_tokens ?? 0
  if (![cached, write].every((n) => Number.isSafeInteger(n) && n >= 0) || cached + write > input!) return null
  if (model === 'gpt-4o-mini-transcribe') return { input, output, cached: 0, write: 0, nano: Math.round(input! * 1250 + output! * 5000), rates: [1.25, 5] }
  if (model !== 'gpt-6-luna') return null
  const long = input! > 272_000
  const rates = long ? [0.20, 0.02, 0.25, 0.75] : [0.10, 0.01, 0.125, 0.50]
  const nano = Math.round(((input! - cached - write) * rates[0] + cached * rates[1] + write * rates[2] + output! * rates[3]) * 1000)
  return { input, output, cached, write, nano, rates }
}

export const usageSchema = `
  create table if not exists api_usage (
    id text primary key,
    user_id text not null references "user"(id) on delete cascade,
    kind text not null check (kind in ('image', 'audio', 'assistant')),
    model text not null,
    created_at timestamptz not null default now(),
    status text not null default 'pending',
    usage jsonb,
    cost_nano bigint,
    rates jsonb
  );
  create index if not exists api_usage_user_time on api_usage(user_id, created_at);
  create index if not exists api_usage_time on api_usage(created_at);
  do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'api_usage_kind_check' and pg_get_constraintdef(oid) like '%assistant%') then
      alter table api_usage drop constraint if exists api_usage_kind_check;
      alter table api_usage add constraint api_usage_kind_check check (kind in ('image', 'audio', 'assistant'));
    end if;
  end $$;
`

export function usageRecorder(db: Pick<pg.Pool, 'query'>) {
  return async (userId: string, kind: string, model: string) => {
    const id = crypto.randomUUID()
    // Record before spending; a lost response stays visible as an unknown cost.
    await db.query('insert into api_usage (id, user_id, kind, model) values ($1,$2,$3,$4)', [id, userId, kind, model])
    return async (usage: unknown, status: string) => {
      const cost = estimate(model, usage)
      await db.query('update api_usage set status=$2, usage=$3, cost_nano=$4, rates=$5 where id=$1',
        [id, status, cost ? JSON.stringify({ input: cost.input, output: cost.output, cached: cost.cached, write: cost.write }) : null, cost?.nano ?? null, cost ? JSON.stringify(cost.rates) : null])
    }
  }
}
export type UsageRecorder = ReturnType<typeof usageRecorder>

export function periodRange(period: string, offset: number, now = new Date()) {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const start = new Date(`${local}T00:00:00Z`)
  if (period === 'month') { start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() + offset) }
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7 + offset * 7)
  const end = new Date(start)
  if (period === 'month') end.setUTCMonth(end.getUTCMonth() + 1)
  else end.setUTCDate(end.getUTCDate() + 7)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

type User = { id: string; email: string; emailVerified: boolean }
export function usageRoutes(db: Pick<pg.Pool, 'query'>, getUser: (r: Request) => Promise<User | undefined>) {
  const app = new Hono<{ Variables: { user: User } }>()
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    const user = await getUser(c.req.raw)
    if (!user) return c.json({ error: 'Please sign in again.' }, 401)
    c.set('user', user)
    await next()
  })
  app.get('/:scope', async (c) => {
    const user = c.get('user'), scope = c.req.param('scope')
    if (scope !== 'me' && scope !== 'admin') return c.json({ error: 'Not found.' }, 404)
    if (scope === 'admin' && !isAdmin(user)) return c.json({ error: 'Admin access required.' }, 403)
    const period = c.req.query('period') ?? 'month', offset = Number(c.req.query('offset') ?? 0)
    if (!['week', 'month'].includes(period) || !Number.isInteger(offset) || offset > 0 || offset < -120) return c.json({ error: 'Invalid period.' }, 400)
    const range = periodRange(period, offset)
    const { rows } = await db.query(`
      select u.id, u.name, u.email,
        count(a.id)::int as calls,
        count(a.id) filter (where a.kind='image')::int as camera,
        count(a.id) filter (where a.kind in ('audio', 'assistant'))::int as voice,
        count(a.id) filter (where a.cost_nano is null)::int as unknown,
        coalesce(sum(a.cost_nano),0)::text as nano
      from "user" u left join api_usage a on a.user_id=u.id
        and a.created_at >= ($1::timestamp at time zone 'Australia/Melbourne')
        and a.created_at < ($2::timestamp at time zone 'Australia/Melbourne')
      where ($3::text is null or u.id=$3)
      group by u.id order by coalesce(sum(a.cost_nano),0) desc, u.id`, [range.start, range.end, scope === 'admin' ? null : user.id])
    return c.json({ ...range, accounts: rows.map(({ nano, ...row }) => ({ ...row, usd: Number(nano) / 1e9 })) })
  })
  return app
}
