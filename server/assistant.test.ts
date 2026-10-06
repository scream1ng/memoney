import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assistantRoutes, pgAssistantData, type AssistantData } from './assistant.ts'
import type { AssistantReply, Note, Tx } from '../src/lib/types.ts'

const origin = 'https://memoney.example'
const fetchMock = vi.fn()
const tx = (id: string, userId: string, amount: number): Tx & { userId: string } =>
  ({ id, userId, type: 'expense', amount, category: 'food', date: '2026-10-05', merchant: 'Cafe', createdAt: 1 })
const txRows = [tx('t1', 'a', 10000), tx('t2', 'a', 12000), tx('x1', 'b', 10000)]
const noteRows: (Note & { userId: string })[] = [
  { id: 'n1', userId: 'a', text: 'Trip', createdAt: 1, updatedAt: 1 },
  { id: 'nx', userId: 'b', text: 'Secret', createdAt: 1, updatedAt: 1 },
]
const strip = <T extends { userId: string }>(row: T): Omit<T, 'userId'> => { const rest: Partial<T> = { ...row }; delete rest.userId; return rest as Omit<T, 'userId'> }
const data: AssistantData = {
  async transactions(userId, f) {
    return txRows.filter((t) => t.userId === userId && (!f.ids || f.ids.includes(t.id)) && t.amount >= (f.min ?? 0) && t.amount <= (f.max ?? Infinity)).map(strip)
  },
  async notes(userId, f) { return noteRows.filter((n) => n.userId === userId && (!f.ids || f.ids.includes(n.id))).map(strip) },
  async categories() { return [] },
}

function ask(text = 'find 100 baht', extra: Record<string, string> = {}) {
  const body = new FormData()
  body.set('text', text)
  body.set('today', '2026-10-06')
  body.set('currency', '฿')
  body.set('tz', 'Asia/Bangkok')
  for (const [k, v] of Object.entries(extra)) body.set(k, v)
  return { method: 'POST', body, headers: { origin } }
}
const call = (name: string, args: unknown) => Response.json({ status: 'completed', output: [{ type: 'function_call', name, call_id: `c-${name}`, arguments: JSON.stringify(args) }] })
const answer = (value: Record<string, unknown>) => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
  reply: 'ok', show_transactions: [], show_notes: [], summary_title: null, choose_one: false, actions: [], ...value }) }] }] })

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('assistant API', () => {
  it('rejects signed-out and cross-origin requests before calling OpenAI', async () => {
    expect((await assistantRoutes(async () => undefined, origin, data).request('/', ask())).status).toBe(401)
    const app = assistantRoutes(async () => 'a', origin, data)
    expect((await app.request('/', { ...ask(), headers: { origin: 'https://other.example' } })).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects requests without speech or text', async () => {
    const app = assistantRoutes(async () => 'a', origin, data)
    expect((await app.request('/', ask(' '))).status).toBe(400)
    expect((await app.request('/', ask('hi', { today: '2026-13-40' }))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('runs tools on the user’s own data and shows only rows it looked up', async () => {
    fetchMock
      .mockResolvedValueOnce(call('find_transactions', { from: null, to: null, type: null, category: null, min_amount: 100, max_amount: 100, text: null }))
      .mockResolvedValueOnce(answer({ reply: 'Found one', show_transactions: ['t1', 'x1', 't2'] }))
    const res = await assistantRoutes(async () => 'a', origin, data).request('/', ask())
    expect(res.status).toBe(200)
    const body = await res.json() as AssistantReply
    // t2 was never returned by a tool and x1 is another account's
    expect(body.transactions.map((t) => t.id)).toEqual(['t1'])
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    const output = second.input.find((i: { type?: string }) => i.type === 'function_call_output')
    expect(JSON.parse(output.output)).toMatchObject({ count: 1, total_expense: 100, rows: [{ id: 't1', amount: 100 }] })
  })

  it('only proposes changes: foreign ids are dropped, amounts become minor units', async () => {
    fetchMock.mockResolvedValueOnce(answer({ actions: [
      { kind: 'delete_tx', id: 'x1' }, { kind: 'edit_note', id: 'nx', text: 'mine now' },
      { kind: 'delete_note', id: 'n1' },
      { kind: 'add_tx', type: 'expense', amount: 60.5, category: 'food', date: null, merchant: 'Coffee', note: null },
      { kind: 'add_tx', type: 'expense', amount: 10, category: 'not-a-category', date: null, merchant: null, note: null },
    ] }))
    const before = JSON.stringify([txRows, noteRows])
    const body = await (await assistantRoutes(async () => 'a', origin, data).request('/', ask('stuff'))).json() as AssistantReply
    expect(body.actions).toEqual([
      { kind: 'delete_note', note: { id: 'n1', text: 'Trip', createdAt: 1, updatedAt: 1 } },
      { kind: 'add_tx', tx: { type: 'expense', amount: 6050, category: 'food', date: '2026-10-06', merchant: 'Coffee' } },
      { kind: 'add_tx', tx: { type: 'expense', amount: 1000, date: '2026-10-06' } },
    ])
    expect(JSON.stringify([txRows, noteRows])).toBe(before)
  })

  it('drops edits that change nothing', async () => {
    fetchMock.mockResolvedValueOnce(answer({ actions: [
      { kind: 'edit_tx', id: 't1', amount: 100, type: null, category: null, date: null, merchant: null, note: null },
      { kind: 'edit_tx', id: 't1', amount: 150, type: null, category: null, date: null, merchant: null, note: null },
    ] }))
    const body = await (await assistantRoutes(async () => 'a', origin, data).request('/', ask('change it'))).json() as AssistantReply
    expect(body.actions).toEqual([{ kind: 'edit_tx', before: strip(txRows[0]), after: { ...strip(txRows[0]), amount: 15000 } }])
  })

  it('offers a choice only between two additions', async () => {
    fetchMock.mockResolvedValueOnce(answer({ choose_one: true, actions: [
      { kind: 'add_tx', type: 'expense', amount: 8000, category: 'bills', date: '2026-10-30', merchant: null, note: 'Rent' },
      { kind: 'add_note', text: 'Rent 8,000 on the 30th' },
    ] }))
    const body = await (await assistantRoutes(async () => 'a', origin, data).request('/', ask('rent 8000 on the 30th'))).json() as AssistantReply
    expect(body.choose).toBe(true)
    expect(body.actions.map((a) => a.kind)).toEqual(['add_tx', 'add_note'])
  })

  it('transcribes speech first and records every call as assistant usage', async () => {
    const finish = vi.fn()
    const record = vi.fn(async () => finish)
    fetchMock
      .mockResolvedValueOnce(Response.json({ text: 'open stats for last month', usage: { input_tokens: 5 } }))
      .mockResolvedValueOnce(answer({ actions: [{ kind: 'navigate', page: 'stats', date: '2026-09-01', period: 'month', now: true }] }))
    const body = new FormData()
    body.set('file', new Blob(['audio'], { type: 'audio/webm' }), 'blob')
    body.set('today', '2026-10-06')
    body.set('currency', '฿')
    const res = await assistantRoutes(async () => 'a', origin, data, record).request('/', { method: 'POST', body, headers: { origin } })
    const reply = await res.json() as AssistantReply
    expect(reply.heard).toBe('open stats for last month')
    expect(reply.actions).toEqual([{ kind: 'navigate', page: 'stats', date: '2026-09-01', period: 'month', now: true }])
    expect(record.mock.calls).toEqual([['a', 'assistant', 'gpt-4o-mini-transcribe'], ['a', 'assistant', 'gpt-6-luna']])
    expect(finish).toHaveBeenCalledTimes(2)
  })

  it('stops calling tools after the last round and fails cleanly upstream', async () => {
    fetchMock.mockImplementation(async () => call('find_notes', { text: null }))
    const res = await assistantRoutes(async () => 'a', origin, data).request('/', ask())
    expect(res.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(JSON.parse(fetchMock.mock.calls[3][1].body as string).tool_choice).toBe('none')
    expect(await res.json()).toEqual({ error: 'Couldn’t do that right now. Try again.' })
  })

  it('totals a summary over every match, not just the rows shown', async () => {
    fetchMock
      .mockResolvedValueOnce(call('find_transactions', { from: null, to: null, type: null, category: null, min_amount: null, max_amount: null, text: null }))
      .mockResolvedValueOnce(answer({ reply: 'You spent 220', show_transactions: ['t1'], summary_title: 'Yesterday' }))
    const body = await (await assistantRoutes(async () => 'a', origin, data).request('/', ask('what did I spend'))).json() as AssistantReply
    expect(body.transactions.map((t) => t.id)).toEqual(['t1'])
    expect(body.summary).toEqual({ title: 'Yesterday', expense: 22000, byCategory: { food: 22000 } })
  })

  it('gives the model the whole note, so an edit can’t cut it short', async () => {
    const long = 'Shopping\n' + 'x'.repeat(1500)
    noteRows.push({ id: 'n2', userId: 'a', text: long, createdAt: 1, updatedAt: 1 })
    try {
      fetchMock
        .mockResolvedValueOnce(call('find_notes', { text: null }))
        .mockResolvedValueOnce(answer({}))
      await assistantRoutes(async () => 'a', origin, data).request('/', ask('add milk to shopping'))
      const second = JSON.parse(fetchMock.mock.calls[1][1].body as string)
      const output = JSON.parse(second.input.find((i: { type?: string }) => i.type === 'function_call_output').output)
      expect(output.notes.find((n: { id: string }) => n.id === 'n2').text).toBe(long)
    } finally { noteRows.pop() }
  })
})

describe('assistant data', () => {
  it('keeps the receipt photo on rows, so an edit saved back doesn’t drop it', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 't1', type: 'expense', amount: 100, category: 'food', date: '2026-10-05', note: null, merchant: null, createdAt: 1, photoAt: 5 }] })
    const [row] = await pgAssistantData({ query } as never, async () => []).transactions('a', { ids: ['t1'] })
    expect(row.photoAt).toBe(5)
    expect(query.mock.calls[0][0]).toContain('attachments')
  })
})
