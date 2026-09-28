import { today } from './format'
import type { Guess } from './types'
export type { Guess } from './types'

export async function parse(input: Blob | string, kind: 'audio' | 'image', currency: string, signal?: AbortSignal): Promise<Guess> {
  const body = new FormData()
  if (kind === 'image') body.append('file', await compressPhoto(input as Blob))
  else body.append('text', input as string)
  body.append('kind', kind)
  body.append('today', today())
  body.append('currency', currency)
  const r = await fetch('/api/parse', { method: 'POST', credentials: 'include', body,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(70_000)]) : AbortSignal.timeout(70_000) })
  if (!r.ok) {
    const error = await r.json().catch(() => ({}))
    throw new Error(typeof error.error === 'string' ? error.error : 'Couldn’t read that. Try again or type your entry.')
  }
  return (await r.json()) as Guess
}

async function compressPhoto(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Couldn’t prepare this photo. Try a different photo.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Couldn’t prepare this photo. Try a different photo.')), 'image/jpeg', 0.85,
    ))
  } finally { URL.revokeObjectURL(url) }
}
