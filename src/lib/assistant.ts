import { today } from './format'
import type { AssistantReply, Turn } from './types'

/** One assistant turn: a recording or typed text, plus the conversation so far. Never writes anything. */
export async function ask(input: Blob | string, history: Turn[], currency: string, signal?: AbortSignal): Promise<AssistantReply> {
  const body = new FormData()
  if (typeof input === 'string') body.append('text', input)
  else body.append('file', input)
  body.append('today', today())
  body.append('currency', currency)
  body.append('tz', Intl.DateTimeFormat().resolvedOptions().timeZone)
  body.append('history', JSON.stringify(history.slice(-10)))
  const timeout = AbortSignal.timeout(90_000)
  const r = await fetch('/api/assistant', { method: 'POST', credentials: 'include', body,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  if (!r.ok) {
    const error = await r.json().catch(() => ({}))
    throw new Error(typeof error.error === 'string' ? error.error : 'Couldn’t get an answer. Try again.')
  }
  return (await r.json()) as AssistantReply
}
