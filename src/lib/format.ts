const pad = (n: number) => String(n).padStart(2, '0')

/** Local YYYY-MM-DD (never via toISOString — that is UTC and shifts the day). */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const today = () => toDateKey(new Date())

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** YYYY-MM */
export const monthKey = (dateKey: string) => dateKey.slice(0, 7)

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function dayLabel(dateKey: string): string {
  if (dateKey === today()) return 'Today'
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (dateKey === toDateKey(y)) return 'Yesterday'
  return fromDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

const nf = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export function money(minor: number, symbol = ''): string {
  return `${symbol}${nf.format(minor / 100)}`
}

/** "12.5" → 1250 */
export function parseAmount(input: string): number {
  const n = Number.parseFloat(input)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** 1250 → "12.5" (keypad editable form) */
export function amountToInput(minor: number): string {
  return String(minor / 100)
}

export function uid(): string {
  // crypto.randomUUID is missing on plain-http LAN testing
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}
