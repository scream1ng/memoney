import { useSyncExternalStore } from 'react'
import type { Note } from './types'

/** Server-backed like the transaction repo; publishes only after the server confirms. */
function apiNotes() {
  const listeners = new Set<() => void>()
  let cache: Note[] = []
  const set = (next: Note[]) => {
    cache = next
    listeners.forEach((l) => l())
  }
  const call = (path: string, init?: RequestInit) =>
    // the list lives at /api/notes, without a trailing slash
    fetch(path ? `/api/notes/${path}` : '/api/notes', { credentials: 'include', ...init }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} notes/${path}`)
      return r
    })
  return {
    list: () => cache,
    async load() {
      set(await (await call('')).json())
    },
    async save(note: Note) {
      await call(note.id, { method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: note.text, createdAt: note.createdAt, updatedAt: note.updatedAt }) })
      set([...cache.filter((n) => n.id !== note.id), note])
    },
    async remove(id: string) {
      await call(id, { method: 'DELETE' })
      set(cache.filter((n) => n.id !== id))
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}

export const notesRepo = apiNotes()

export function useNotes(): Note[] {
  return useSyncExternalStore(notesRepo.subscribe, notesRepo.list)
}

/** Speech to text for a voice note; nothing is saved. */
export async function transcribe(audio: Blob, signal?: AbortSignal): Promise<string> {
  const body = new FormData()
  body.append('file', audio)
  const timeout = AbortSignal.timeout(70_000)
  const r = await fetch('/api/parse/transcribe', { method: 'POST', credentials: 'include', body,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  if (!r.ok) {
    const error = await r.json().catch(() => ({}))
    throw new Error(typeof error.error === 'string' ? error.error : 'Couldn’t hear that. Try again or type your note.')
  }
  return ((await r.json()) as { text: string }).text
}

/** First line is the title, the rest the preview. */
export function noteParts(text: string): [string, string] {
  const [title, ...rest] = text.trim().split('\n')
  return [title.trim(), rest.join(' ').trim()]
}
