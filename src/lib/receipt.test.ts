import { describe, expect, it } from 'vitest'
import { parseReceipt } from './receipt'

describe('parseReceipt', () => {
  it('reads an English receipt', () => {
    const r = parseReceipt(`STARBUCKS COFFEE
Tax ID 0105556000000
27/09/2026 08:14
Latte          145.00
Muffin          85.00
Subtotal       230.00
VAT 7%          15.05
TOTAL          230.00
Cash          1000.00
Change         770.00`)
    expect(r.amount).toBe(23000)
    expect(r.date).toBe('2026-09-27')
    expect(r.merchant).toBe('STARBUCKS COFFEE')
  })

  it('reads a Thai receipt with Buddhist-era year and spaced glyphs', () => {
    const r = parseReceipt(`7-Eleven
สาขา 01234
วันที่ 27/09/2569
ข้าวกล่อง 45.00
น้ำดื่ม 10.00
ร ว ม ทั้ง สิ้น 1,055.00
เงินสด 1,100.00
เงินทอน 45.00`)
    expect(r.amount).toBe(105500)
    expect(r.date).toBe('2026-09-27')
    expect(r.merchant).toBe('7-Eleven')
  })

  it('joins spaced-out Thai merchant names', () => {
    expect(parseReceipt('ร ้ า น ก า แฟ ด ี\nรวม 90.00').merchant).toBe('ร้านกาแฟดี')
  })

  it('prefers grand total over total', () => {
    const r = parseReceipt(`Shop
Total 100.00
Service 10.00
Grand Total 110.00`)
    expect(r.amount).toBe(11000)
  })

  it('takes amount from next line when keyword stands alone', () => {
    expect(parseReceipt('Shop\nTOTAL\n59.50').amount).toBe(5950)
  })

  it('falls back to largest decimal amount, ignoring cash lines', () => {
    expect(parseReceipt('Cafe\nTea 40.00\nCake 75.50\nCash 500.00').amount).toBe(7550)
  })

  it('handles ISO dates and 2-digit years', () => {
    expect(parseReceipt('x\n2026-01-05').date).toBe('2026-01-05')
    expect(parseReceipt('x\n05/01/26').date).toBe('2026-01-05')
    expect(parseReceipt('x\n05/01/69').date).toBe('2026-01-05')
  })

  it('returns nothing useful for junk', () => {
    expect(parseReceipt('')).toEqual({ amount: undefined, date: undefined, merchant: undefined })
  })
})
