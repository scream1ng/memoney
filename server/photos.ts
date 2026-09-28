import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type pg from 'pg'

type Db = Pick<pg.Pool, 'query'>

const MAX_BYTES = 3 * 1024 * 1024

export const photoSchema = `
  create table if not exists attachments (
    tx_id text primary key references transactions(id) on delete cascade,
    user_id text not null references "user"(id) on delete cascade,
    mime text not null,
    bytes bytea not null,
    created_at bigint not null
  );
`

/** Where receipt photos live. Only this knows it's Postgres, so a bucket can replace it later. */
export interface PhotoStore {
  /** false when the transaction isn't the user's */
  put(userId: string, txId: string, bytes: Buffer, at: number): Promise<boolean>
  get(userId: string, txId: string): Promise<Buffer | undefined>
  remove(userId: string, txId: string): Promise<void>
}

export function pgPhotoStore(db: Db): PhotoStore {
  return {
    async put(userId, txId, bytes, at) {
      const { rowCount } = await db.query(
        `insert into attachments (tx_id, user_id, mime, bytes, created_at)
         select $1, $2, 'image/jpeg', $3, $4 where exists (select 1 from transactions where id = $1 and user_id = $2)
         on conflict (tx_id) do update set bytes = $3, created_at = $4 where attachments.user_id = $2`,
        [txId, userId, bytes, at],
      )
      return !!rowCount
    },
    async get(userId, txId) {
      const { rows } = await db.query('select bytes from attachments where tx_id = $1 and user_id = $2', [txId, userId])
      return rows[0]?.bytes
    },
    async remove(userId, txId) {
      await db.query('delete from attachments where tx_id = $1 and user_id = $2', [txId, userId])
    },
  }
}

/** Mounted at /api/tx. The client always re-encodes to JPEG, so nothing else is accepted (an SVG would run script on our origin). */
export function photoRoutes(store: PhotoStore, userIdOf: (request: Request) => Promise<string | undefined>) {
  const app = new Hono<{ Variables: { userId: string } }>()
  app.use('/:id/photo', async (c, next) => {
    const userId = await userIdOf(c.req.raw)
    if (!userId) return c.json({ error: 'unauthorized' }, 401)
    c.set('userId', userId)
    await next()
  })
  app.put('/:id/photo', bodyLimit({ maxSize: MAX_BYTES, onError: (c) => c.json({ error: 'too large' }, 413) }), async (c) => {
    if (c.req.header('content-type') !== 'image/jpeg') return c.json({ error: 'jpeg only' }, 415)
    const bytes = Buffer.from(await c.req.arrayBuffer())
    if (!bytes.length) return c.json({ error: 'empty' }, 400)
    const at = Date.now()
    if (!(await store.put(c.get('userId'), c.req.param('id'), bytes, at))) return c.json({ error: 'not found' }, 404)
    return c.json({ photoAt: at })
  })
  app.get('/:id/photo', async (c) => {
    const bytes = await store.get(c.get('userId'), c.req.param('id'))
    if (!bytes) return c.json({ error: 'not found' }, 404)
    // the URL carries ?v=<photoAt>, so a replaced photo gets a new URL
    return c.body(new Uint8Array(bytes), 200, {
      'content-type': 'image/jpeg',
      'cache-control': 'private, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    })
  })
  app.delete('/:id/photo', async (c) => {
    await store.remove(c.get('userId'), c.req.param('id'))
    return c.body(null, 204)
  })
  return app
}
