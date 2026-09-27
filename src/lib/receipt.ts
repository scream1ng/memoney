import { toDateKey } from './format'

export interface ReceiptGuess {
  /** minor units */
  amount?: number
  date?: string
  merchant?: string
}

const AMOUNT_RE = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+/g

// English checked on the lowercased line, Thai on the line with all whitespace removed
// (Tesseract often splits Thai glyphs with spaces).
const STRONG = /grand\s*total|total\s*due|amount\s*due|net\s*total|total\s*amount|ทั้งสิ้น|สุทธิ|ยอดชำระ/
const WEAK = /\btotal\b|ยอดรวม|รวม/
const SKIP = /sub\s*-?\s*total|subtotal|cash|change|tendered|vat|tax|discount|เงินสด|เงินทอน|ทอน|รับเงิน|ภาษี|ส่วนลด|ก่อนภาษี/
const NOT_MERCHANT = /tax|tel|receipt|invoice|pos|vat|date|time|ใบเสร็จ|เลขประจำตัว|โทร|วันที่|สาขา|ใบกำกับ/i

function amountsIn(line: string): number[] {
  const out: number[] = []
  for (const m of line.matchAll(AMOUNT_RE)) {
    const n = Number.parseFloat(m[0].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0 && n < 10_000_000) out.push(Math.round(n * 100))
  }
  return out
}

function score(line: string): number {
  const lower = line.toLowerCase()
  const thai = line.replace(/\s+/g, '')
  if (SKIP.test(lower) || SKIP.test(thai)) {
    // "รวมทั้งสิ้น (incl. VAT)" is still the total
    if (STRONG.test(lower) || STRONG.test(thai)) return 3
    return 0
  }
  if (STRONG.test(lower) || STRONG.test(thai)) return 3
  if (WEAK.test(lower) || WEAK.test(thai)) return 2
  return 1
}

function findAmount(lines: string[]): number | undefined {
  let best: { score: number; amount: number } | undefined
  lines.forEach((line, i) => {
    const s = score(line)
    if (s < 2) return
    // amount usually on the same line, else the next one
    const nums = amountsIn(line.replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g, ''))
    const candidates = nums.length ? nums : amountsIn(lines[i + 1] ?? '')
    if (!candidates.length) return
    const amount = candidates[candidates.length - 1]
    if (!best || s > best.score || (s === best.score && amount > best.amount)) best = { score: s, amount }
  })
  if (best) return best.amount

  // fallback: largest decimal amount on a non-cash/change line
  let max: number | undefined
  for (const line of lines) {
    if (score(line) === 0 || !/\d\.\d{2}\b/.test(line)) continue
    for (const n of amountsIn(line)) if (max === undefined || n > max) max = n
  }
  return max
}

function normYear(y: number): number {
  if (y < 100) y = y >= 50 ? 2500 + y : 2000 + y // 2-digit: 69 → BE 2569, 26 → 2026
  if (y > 2400) y -= 543 // Buddhist era
  return y
}

function validDate(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined
  const dt = new Date(y, m - 1, d)
  if (dt.getMonth() !== m - 1) return undefined
  return toDateKey(dt)
}

function findDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (iso) {
    const r = validDate(normYear(+iso[1]), +iso[2], +iso[3])
    if (r) return r
  }
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
    const a = +m[1]
    const b = +m[2]
    const y = normYear(+m[3])
    // day-first by default; swap only when it can't be day-first
    const r = a > 12 || b <= 12 ? validDate(y, b, a) : validDate(y, a, b)
    if (r) return r
  }
  return undefined
}

function findMerchant(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 6)) {
    const letters = line.replace(/[^\p{L}]/gu, '')
    if (letters.length < 3 || NOT_MERCHANT.test(line)) continue
    if ((line.match(/\d/g)?.length ?? 0) > letters.length) continue
    return line
      .replace(/(?<=[\u0E00-\u0E7F])\s+(?=[\u0E00-\u0E7F])/g, '') // Tesseract spaces out Thai glyphs
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 40)
  }
  return undefined
}

export function parseReceipt(text: string): ReceiptGuess {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return { amount: findAmount(lines), date: findDate(text), merchant: findMerchant(lines) }
}
