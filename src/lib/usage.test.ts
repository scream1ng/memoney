import { afterEach, expect, it, vi } from 'vitest'
import { loadUsage } from './usage'

afterEach(() => vi.restoreAllMocks())

it('times out a stalled usage request so the screen can offer Retry', async () => {
  const timeout = new AbortController()
  const timer = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true })
  }))
  const request = loadUsage(false, 'month', 0, new AbortController().signal)
  timeout.abort(new DOMException('Timed out', 'TimeoutError'))
  await expect(request).rejects.toThrow('Usage took too long to load. Try again.')
  expect(timer).toHaveBeenCalledWith(15_000)
})

it('aborts an old request when the user changes period', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true })
  }))
  const controller = new AbortController()
  const request = loadUsage(true, 'week', -1, controller.signal)
  controller.abort()
  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
})

it('handles forbidden responses and permits a successful retry', async () => {
  const report = { start: '2026-09-01', end: '2026-10-01', accounts: [] }
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 403 })).mockResolvedValueOnce(Response.json(report))
  await expect(loadUsage(true, 'month', 0, new AbortController().signal)).rejects.toThrow('Admin access required.')
  await expect(loadUsage(true, 'month', 0, new AbortController().signal)).resolves.toEqual(report)
})
