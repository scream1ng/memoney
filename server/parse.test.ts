import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseRoutes } from './parse.ts'

const origin = 'https://memoney.example'
const expense = { type: 'expense', amount: 14500, category: 'food', date: '2026-09-28', note: null, merchant: 'Coffee Shop' }
const fetchMock = vi.fn()

function upload(kind = 'image', mime = 'image/jpeg', bytes: string | Uint8Array<ArrayBuffer> = 'photo') {
  const body = new FormData()
  body.set('file', new Blob([bytes], { type: mime }), 'blob')
  body.set('kind', kind)
  body.set('today', '2026-09-28')
  body.set('currency', '฿')
  return { method: 'POST', body, headers: { origin } }
}

function completion(value: unknown = expense) {
  return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] })
}

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

describe('camera and voice API', () => {
  it('rejects signed-out requests before calling OpenAI', async () => {
    const app = parseRoutes(async () => undefined, origin)
    expect((await app.request('/', upload())).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests', async () => {
    const app = parseRoutes(async () => 'user', origin)
    expect((await app.request('/', { ...upload(), headers: { origin: 'https://other.example' } })).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports missing configuration without calling OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const app = parseRoutes(async () => 'user', origin)
    expect((await app.request('/', upload())).status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reads an image through Luna and returns minor units without saving anything', async () => {
    fetchMock.mockResolvedValueOnce(completion())
    const app = parseRoutes(async () => 'user', origin)
    const response = await app.request('/', upload())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ type: 'expense', amount: 14500, category: 'food', date: '2026-09-28', merchant: 'Coffee Shop' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(options.headers.Authorization).toBe('Bearer test-key')
    const sent = JSON.parse(options.body)
    expect(sent.model).toBe('gpt-6-luna')
    expect(sent.store).toBe(false)
    expect(sent.instructions).toContain('2026-09-28')
    expect(sent.input[0].content[1]).toEqual({ type: 'input_image', image_url: 'data:image/jpeg;base64,cGhvdG8=', detail: 'high' })
    expect(sent.text.format.strict).toBe(true)
    expect(sent.text.format.schema.properties.category.enum).not.toContain('work-travel')
    expect(sent.text.format.schema.properties.category.enum).not.toContain('other-in')
  })

  it('offers the user’s salary sources to AI and keeps its choice in category', async () => {
    const sources = [
      { id: 'salary-a', type: 'income' as const, label: 'Salary · A', icon: 'briefcase', color: '#248a3d', clues: 'A Payroll' },
      { id: 'salary-b', type: 'income' as const, label: 'Salary · B', icon: 'briefcase', color: '#248a3d', clues: 'B Payroll' },
    ]
    fetchMock.mockResolvedValueOnce(completion({ type: 'income', amount: 42000, category: 'salary-b', date: '2026-09-28', note: null, merchant: 'B Payroll' }))
    const app = parseRoutes(async () => 'user', origin, undefined, async () => sources)
    const response = await app.request('/', upload())
    expect(await response.json()).toEqual({ type: 'income', amount: 42000, category: 'salary-b', date: '2026-09-28', merchant: 'B Payroll' })
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.instructions).toContain('B Payroll')
    expect(sent.instructions).toContain('Put that id in category, not only in note')
    expect(sent.text.format.schema.properties.category.enum).toContain('salary-b')
  })

  it.each([['audio/webm;codecs=opus', 'webm'], ['audio/mp4', 'mp4']])('transcribes %s before extracting an expense', async (mime, extension) => {
    fetchMock.mockResolvedValueOnce(Response.json({ text: 'กาแฟ 145 บาท' })).mockResolvedValueOnce(completion())
    const app = parseRoutes(async () => 'user', origin)
    const response = await app.request('/', upload('audio', mime, 'audio'))
    expect(response.status).toBe(200)
    expect((await response.json() as { heard?: string }).heard).toBe('กาแฟ 145 บาท')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect(options.body.get('file').name).toBe(`recording.${extension}`)
    expect(options.body.get('model')).toBe('gpt-4o-transcribe')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).input[0].content).toEqual([{ type: 'input_text', text: 'กาแฟ 145 บาท' }])
  })

  it('honors an explicit spoken category over the AI guess', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ text: 'จ่ายค่าไฟ 500 บาท ให้ลงหมวด Transport' }))
      .mockResolvedValueOnce(completion({ ...expense, amount: 50000, category: 'bills' }))
    const app = parseRoutes(async () => 'user', origin)
    const response = await app.request('/', upload('audio', 'audio/webm', 'audio'))
    expect((await response.json() as { category?: string }).category).toBe('transport')
  })

  it('recognizes a Thai transcription of Transport', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ text: 'จ่ายค่าไฟ 500 บาท ให้ลงหมวดทรานสปอร์ต' }))
      .mockResolvedValueOnce(completion({ ...expense, amount: 50000, category: 'bills' }))
    const app = parseRoutes(async () => 'user', origin)
    const response = await app.request('/', upload('audio', 'audio/webm', 'audio'))
    expect((await response.json() as { category?: string }).category).toBe('transport')
  })

  it('keeps the AI guess when no category command was spoken', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ text: 'จ่ายค่าไฟ 500 บาท' }))
      .mockResolvedValueOnce(completion({ ...expense, amount: 50000, category: 'bills' }))
    const app = parseRoutes(async () => 'user', origin)
    const response = await app.request('/', upload('audio', 'audio/webm', 'audio'))
    expect((await response.json() as { category?: string }).category).toBe('bills')
  })

  it('honors a spoken custom category name', async () => {
    const custom = [{ id: 'salary-b', type: 'income' as const, label: 'Salary · B', icon: 'briefcase', color: '#248a3d', clues: '' }]
    fetchMock.mockResolvedValueOnce(Response.json({ text: 'ได้เงิน 420 บาท ลงหมวด Salary · B' }))
      .mockResolvedValueOnce(completion({ type: 'income', amount: 42000, category: 'salary', date: null, note: null, merchant: null }))
    const app = parseRoutes(async () => 'user', origin, undefined, async () => custom)
    const response = await app.request('/', upload('audio', 'audio/webm', 'audio'))
    expect((await response.json() as { category?: string }).category).toBe('salary-b')
  })

  it.each([['image', 'text/html'], ['audio', 'image/jpeg'], ['other', 'image/jpeg']])('rejects %s with %s', async (kind, mime) => {
    const app = parseRoutes(async () => 'user', origin)
    expect((await app.request('/', upload(kind, mime))).status).toBe(415)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects empty files and impossible context dates', async () => {
    const app = parseRoutes(async () => 'user', origin)
    expect((await app.request('/', upload('image', 'image/jpeg', ''))).status).toBe(400)
    const request = upload()
    request.body.set('today', '2026-02-30')
    expect((await app.request('/', request)).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects oversized uploads before spending API credit', async () => {
    const app = parseRoutes(async () => 'user', origin)
    expect((await app.request('/', upload('image', 'image/jpeg', new Uint8Array(10 * 1024 * 1024)))).status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('limits requests per user and resets the window', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(async () => completion())
    const app = parseRoutes(async (request) => request.headers.get('x-user') ?? 'user', origin)
    for (let i = 0; i < 10; i++) expect((await app.request('/', upload())).status).toBe(200)
    const limited = await app.request('/', upload())
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')
    expect((await app.request('/', { ...upload(), headers: { origin, 'x-user': 'someone-else' } })).status).toBe(200)
    vi.setSystemTime(Date.now() + 60_001)
    expect((await app.request('/', upload())).status).toBe(200)
  })

  it('does not invent an expense for empty speech', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ text: ' ' }))
    const app = parseRoutes(async () => 'user', origin)
    expect((await app.request('/', upload('audio', 'audio/webm'))).status).toBe(422)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('discards invalid model fields and unknown properties', async () => {
    fetchMock.mockResolvedValueOnce(completion({ ...expense, amount: -20, category: 'salary', date: '2026-02-30', userId: 'other-user' }))
    const app = parseRoutes(async () => 'user', origin)
    expect(await (await app.request('/', upload())).json()).toEqual({ type: 'expense', merchant: 'Coffee Shop' })
  })

  it('reports unrelated content instead of a fabricated transaction', async () => {
    fetchMock.mockResolvedValueOnce(completion({ type: null, amount: null, category: null, date: null, note: null, merchant: null }))
    const app = parseRoutes(async () => 'user', origin)
    expect((await app.request('/', upload())).status).toBe(422)
  })

  it('handles API failures without leaking upstream details', async () => {
    fetchMock.mockResolvedValueOnce(new Response('sensitive upstream error', { status: 429 }))
    const app = parseRoutes(async () => 'user', origin)
    const response = await app.request('/', upload())
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('sensitive')
  })

  it('does not apply incomplete model output', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ status: 'incomplete', output: [] }))
    const app = parseRoutes(async () => 'user', origin)
    expect((await app.request('/', upload())).status).toBe(502)
  })
})

describe('usage attribution', () => {
  it('retains transcription usage when the second voice call fails', async () => {
    const finish = vi.fn().mockResolvedValue(undefined)
    const record = vi.fn().mockResolvedValue(finish)
    fetchMock.mockResolvedValueOnce(Response.json({ text: 'coffee 145', usage: { input_tokens: 20, output_tokens: 4 } }))
      .mockResolvedValueOnce(Response.json({ error: 'failed' }, { status: 500 }))
    const app = parseRoutes(async () => 'member', origin, record)
    expect((await app.request('/', upload('audio', 'audio/webm'))).status).toBe(502)
    expect(record.mock.calls).toEqual([['member', 'audio', 'gpt-4o-transcribe'], ['member', 'audio', 'gpt-6-luna']])
    expect(finish.mock.calls).toEqual([[{ input_tokens: 20, output_tokens: 4 }, 'completed'], [undefined, 'failed']])
  })
  it('records usage before validating an incomplete model result', async () => {
    const finish = vi.fn().mockResolvedValue(undefined)
    const record = vi.fn().mockResolvedValue(finish)
    fetchMock.mockResolvedValueOnce(Response.json({ status: 'incomplete', usage: { input_tokens: 100, output_tokens: 2000 } }))
    expect((await parseRoutes(async () => 'member', origin, record).request('/', upload())).status).toBe(502)
    expect(finish).toHaveBeenCalledWith({ input_tokens: 100, output_tokens: 2000 }, 'incomplete')
  })
  it('does not spend when the initial usage write fails', async () => {
    const record = vi.fn().mockRejectedValue(new Error('database unavailable'))
    expect((await parseRoutes(async () => 'member', origin, record).request('/', upload())).status).toBe(502)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

it('preserves a paid-for result if finalizing its usage record fails', async () => {
  const finish = vi.fn().mockRejectedValue(new Error('database unavailable'))
  const record = vi.fn().mockResolvedValue(finish)
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    fetchMock.mockResolvedValueOnce(completion())
    const response = await parseRoutes(async () => 'member', origin, record).request('/', upload())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ amount: 14500, merchant: 'Coffee Shop' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith('[usage] Could not finalize API usage; cost remains unavailable.')
  } finally { log.mockRestore() }
})

describe('voice note transcription', () => {
  const recording = (mime = 'audio/webm', bytes = 'audio') => {
    const body = new FormData()
    body.set('file', new Blob([bytes], { type: mime }), 'blob')
    return { method: 'POST', body, headers: { origin } }
  }

  it('returns the words only, with one transcription call and no model call', async () => {
    const finish = vi.fn().mockResolvedValue(undefined)
    const record = vi.fn().mockResolvedValue(finish)
    fetchMock.mockResolvedValueOnce(Response.json({ text: '  ซื้อนม\nพรุ่งนี้  ', usage: { input_tokens: 20, output_tokens: 4 } }))
    const response = await parseRoutes(async () => 'member', origin, record).request('/transcribe', recording())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ text: 'ซื้อนม\nพรุ่งนี้' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect(options.body.get('file').name).toBe('recording.webm')
    expect(record).toHaveBeenCalledWith('member', 'audio', 'gpt-4o-transcribe')
    expect(finish).toHaveBeenCalledWith({ input_tokens: 20, output_tokens: 4 }, 'completed')
  })

  it('shares the sign-in, origin and rate limit checks', async () => {
    expect((await parseRoutes(async () => undefined, origin).request('/transcribe', recording())).status).toBe(401)
    expect((await parseRoutes(async () => 'user', origin).request('/transcribe', { ...recording(), headers: { origin: 'https://other.example' } })).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects photos and empty files before spending', async () => {
    const app = parseRoutes(async () => 'user', origin)
    expect((await app.request('/transcribe', recording('image/jpeg'))).status).toBe(415)
    expect((await app.request('/transcribe', recording('audio/webm', ''))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports silence and upstream failures without leaking details', async () => {
    const app = parseRoutes(async () => 'user', origin)
    fetchMock.mockResolvedValueOnce(Response.json({ text: '  ' }))
    expect((await app.request('/transcribe', recording())).status).toBe(422)
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: 'secret detail' } }, { status: 500 }))
    const failed = await app.request('/transcribe', recording())
    expect(failed.status).toBe(502)
    expect(JSON.stringify(await failed.json())).not.toContain('secret')
  })
})
