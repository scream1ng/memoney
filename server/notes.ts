import { Hono } from 'hono'
import type pg from 'pg'
import type { Note } from '../src/lib/types.ts'

export const MAX_NOTE = 2000

export const notesSchema = `
  create table if not exists notes (
    id text primary key,
    user_id text not null references "user"(id) on delete cascade,
    text text not null check (length(text) between 1 and ${MAX_NOTE}),
    created_at bigint not null,
    updated_at bigint not null
  );
  create index if not exists notes_user_time on notes(user_id, created_at desc);
`

export interface NoteStore {
  list(userId: string): Promise<Note[]>
  save(userId: string, note: Note): Promise<boolean>
  remove(userId: string, id: string): Promise<void>
}

const COLS = 'id, text, created_at as "createdAt", updated_at as "updatedAt"'

export function pgNoteStore(db: Pick<pg.Pool, 'query'>): NoteStore {
  return {
    async list(userId) {
      const { rows } = await db.query(`select ${COLS} from notes where user_id = $1 order by created_at desc`, [userId])
      return rows as Note[]
    },
    async save(userId, n) {
      // another account's id stays theirs: the update only applies to the owner's row
      const { rowCount } = await db.query(`insert into notes (id, user_id, text, created_at, updated_at) values ($1,$2,$3,$4,$5)
        on conflict (id) do update set text = $3, updated_at = $5 where notes.user_id = $2`, [n.id, userId, n.text, n.createdAt, n.updatedAt])
      return rowCount === 1
    },
    async remove(userId, id) {
      await db.query('delete from notes where id = $1 and user_id = $2', [id, userId])
    },
  }
}

function input(id: string, value: unknown): Note | undefined {
  if (!value || typeof value !== 'object') return
  const v = value as Record<string, unknown>
  if (typeof v.text !== 'string' || !v.text.trim() || v.text.length > MAX_NOTE) return
  if (!Number.isSafeInteger(v.createdAt) || !Number.isSafeInteger(v.updatedAt)) return
  if (!id || id.length > 64) return
  return { id, text: v.text.trim(), createdAt: v.createdAt as number, updatedAt: v.updatedAt as number }
}

export function noteRoutes(store: NoteStore, getUserId: (r: Request) => Promise<string | undefined>) {
  const app = new Hono<{ Variables: { userId: string } }>()
  app.use('*', async (c, next) => {
    const userId = await getUserId(c.req.raw)
    if (!userId) return c.json({ error: 'Please sign in again.' }, 401)
    c.set('userId', userId)
    c.header('Cache-Control', 'no-store')
    await next()
  })
  app.get('/', async (c) => c.json(await store.list(c.get('userId'))))
  app.put('/:id', async (c) => {
    const note = input(c.req.param('id'), await c.req.json().catch(() => undefined))
    if (!note) return c.json({ error: 'Invalid note.' }, 400)
    if (!await store.save(c.get('userId'), note)) return c.json({ error: 'Note not found.' }, 404)
    return c.body(null, 204)
  })
  app.delete('/:id', async (c) => {
    await store.remove(c.get('userId'), c.req.param('id'))
    return c.body(null, 204)
  })
  return app
}
