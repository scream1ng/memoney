import { scanReceipt } from './ocr'
import type { TxType } from './types'

/** Fields read from a voice clip or receipt photo. Everything is a guess the user confirms. */
export interface Guess {
  type?: TxType
  /** minor units */
  amount?: number
  category?: string
  date?: string
  note?: string
  merchant?: string
  /** what the model heard (voice only) */
  heard?: string
}

export async function parse(blob: Blob, kind: 'audio' | 'image'): Promise<Guess> {
  // photos stay on the on-device OCR until the AI route handles images too
  if (kind === 'image') return { type: 'expense', ...(await scanReceipt(blob)) }
  const body = new FormData()
  body.append('file', blob)
  const r = await fetch('/api/parse', { method: 'POST', credentials: 'include', body })
  if (!r.ok) throw new Error(`${r.status} parse`)
  return (await r.json()) as Guess
}
