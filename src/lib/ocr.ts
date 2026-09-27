import type { Worker } from 'tesseract.js'
import { parseReceipt, type ReceiptGuess } from './receipt'

let worker: Promise<Worker> | undefined

/**
 * One reusable worker, loaded on first scan. Engine + eng/tha language data come from
 * the jsDelivr CDN on first use and are then cached in IndexedDB (works offline afterwards).
 */
function getWorker(): Promise<Worker> {
  worker ??= import('tesseract.js').then(({ createWorker }) => createWorker(['eng', 'tha']))
  worker.catch(() => (worker = undefined))
  return worker
}

/** Downscale to ~1600px long edge + grayscale: faster, and avoids OOM on full-size phone photos. */
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = g
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

export async function scanReceipt(file: Blob): Promise<ReceiptGuess> {
  const [w, canvas] = await Promise.all([getWorker(), prepare(file)])
  const { data } = await w.recognize(canvas)
  return parseReceipt(data.text)
}
