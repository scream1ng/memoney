/// <reference types="node" />
import { readFile } from 'node:fs/promises'
import { beforeEach, expect, it, vi } from 'vitest'
import { PDFDocument, PDFPage } from 'pdf-lib'
import { createReportPdf } from './reportPdf'
import type { Tx } from './types'

const tx: Tx = { id: '1', type: 'income', amount: 42000, category: 'salary', date: '2026-09-28', merchant: 'รายรับร้านจีน', note: 'เงินเดือน', createdAt: 1 }

beforeEach(async () => {
  const font = await readFile('public/fonts/NotoSansThai.ttf')
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(font))
})

it('creates a readable PDF for Thai transaction text and an empty period', async () => {
  const filled = await createReportPdf('28 Sep – 4 Oct 2026', 'week.pdf', [tx], '฿')
  expect(filled.type).toBe('application/pdf')
  expect(filled.name).toBe('week.pdf')
  expect((await PDFDocument.load(await filled.arrayBuffer())).getPageCount()).toBe(1)
  const empty = await createReportPdf('Sep 2026', 'month.pdf', [], '฿')
  expect((await PDFDocument.load(await empty.arrayBuffer())).getPageCount()).toBe(1)
})

it('paginates a long report', async () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ ...tx, id: String(i), note: `บันทึกรายรับ ${i}` }))
  const file = await createReportPdf('Sep 2026', 'many.pdf', many, '฿')
  expect((await PDFDocument.load(await file.arrayBuffer())).getPageCount()).toBeGreaterThan(1)
})

it('reports a font-loading failure instead of producing an unreadable PDF', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }))
  await expect(createReportPdf('Oct 2026', 'failed.pdf', [tx], '$')).rejects.toThrow('Could not load the report font.')
})

it('uses portrait pages and readable transaction rows with type, category, note and receipt', async () => {
  const draw = vi.spyOn(PDFPage.prototype, 'drawText')
  try {
    const expense: Tx = { ...tx, type: 'expense', category: 'software', merchant: 'Monthly tools', note: 'First line\nSecond line', photoAt: 1 }
    const file = await createReportPdf('Sep 2026', 'rows.pdf', [tx, ...Array.from({ length: 30 }, () => expense)], '$')
    const pages = (await PDFDocument.load(await file.arrayBuffer())).getPages()
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every((page) => page.getHeight() > page.getWidth())).toBe(true)
    expect(draw.mock.calls.filter(([text]) => text === 'Transactions')).toHaveLength(pages.length)
    expect(draw.mock.calls.some(([text]) => text === 'Salary')).toBe(true)
    expect(draw.mock.calls.some(([text]) => text === 'Income · 2026-09-28 · Receipt: No')).toBe(true)
    expect(draw.mock.calls.filter(([text]) => text === 'Expense · 2026-09-28 · Receipt: Yes')).toHaveLength(30)
    expect(draw.mock.calls.some(([text]) => text === 'Merchant' || text === 'Monthly tools' || text === tx.merchant)).toBe(false)
    expect(draw.mock.calls.some(([text]) => text === 'Note: First line')).toBe(true)
    expect(draw.mock.calls.some(([text]) => text === 'Second line')).toBe(true)
    for (const [text, options] of draw.mock.calls) {
      if (text === 'MeMoney' || text === 'Sep 2026' || /^\d+$/.test(text)) continue
      expect(options!.size).toBeGreaterThanOrEqual(16)
      expect(options!.y).toBeGreaterThanOrEqual(48)
      expect(options!.x! + options!.font!.widthOfTextAtSize(text, options!.size!)).toBeLessThanOrEqual(pages[0].getWidth() - 28 + 0.01)
    }
  } finally { draw.mockRestore() }
})

it('keeps long notes and large amounts inside the page across continuations', async () => {
  const draw = vi.spyOn(PDFPage.prototype, 'drawText')
  try {
    const note = 'Long multilingual note บันทึกรายรับ '.repeat(100) + 'END OF NOTE'
    const file = await createReportPdf('Oct 2026', 'long.pdf', [{ ...tx, amount: 1234567890123, note }], 'RM')
    const pages = (await PDFDocument.load(await file.arrayBuffer())).getPages()
    expect(pages.length).toBeGreaterThan(1)
    expect(draw.mock.calls.map(([text]) => text).join(' ')).toContain('END OF NOTE')
    for (const [text, options] of draw.mock.calls) {
      expect(options!.y).toBeGreaterThanOrEqual(48)
      expect(options!.x! + options!.font!.widthOfTextAtSize(text, options!.size!)).toBeLessThanOrEqual(pages[0].getWidth() - 28 + 0.01)
    }
  } finally { draw.mockRestore() }
})

it.each(['', '฿', '$', '€', '£', '¥', '₫', 'RM'])('supports the configured currency %s', async (symbol) => {
  const file = await createReportPdf('Sep 2026', 'currency.pdf', [tx], symbol)
  expect(file.size).toBeGreaterThan(0)
})
