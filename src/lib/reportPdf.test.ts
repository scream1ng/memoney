/// <reference types="node" />
import { readFile } from 'node:fs/promises'
import { beforeEach, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
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

it.each(['', '฿', '$', '€', '£', '¥', '₫', 'RM'])('supports the configured currency %s', async (symbol) => {
  const file = await createReportPdf('Sep 2026', 'currency.pdf', [tx], symbol)
  expect(file.size).toBeGreaterThan(0)
})
