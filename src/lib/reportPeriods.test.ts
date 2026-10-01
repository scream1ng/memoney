/// <reference types="node" />
import { readFile } from 'node:fs/promises'
import { beforeEach, expect, it, vi } from 'vitest'
import { PDFDocument, PDFPage } from 'pdf-lib'
import { createReportCsv } from './reportCsv'
import { createReportPdf } from './reportPdf'
import { monthLabel, weekLabel } from './format'
import { forMonth, forWeek, totals } from './store'
import type { Tx } from './types'

const dates = ['2026-09-27', '2026-09-28', '2026-10-01', '2026-10-04', '2026-10-05', '2026-10-31', '2026-11-01']
const transactions: Tx[] = dates.map((date, i) => ({
  id: date, date, type: i === 1 ? 'income' : 'expense', category: i === 1 ? 'salary' : 'food',
  amount: (i + 1) * 100, note: `Entry ${date}`, createdAt: i, photoAt: i === 2 ? 1 : undefined,
}))

beforeEach(async () => {
  const font = await readFile('public/fonts/NotoSansThai.ttf')
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(font))
})

it.each([
  { period: 'week', start: '2026-09-28', expected: ['2026-10-04', '2026-10-01', '2026-09-28'], label: weekLabel('2026-09-28'), income: 200, expense: 700 },
  { period: 'month', start: '2026-10', expected: ['2026-10-31', '2026-10-05', '2026-10-04', '2026-10-01'], label: monthLabel('2026-10'), income: 0, expense: 1800 },
])('exports only the selected $period in PDF and CSV', async ({ period, start, expected, label, income, expense }) => {
  const selected = period === 'week' ? forWeek(transactions, start) : forMonth(transactions, start)
  expect(selected.map((tx) => tx.date)).toEqual(expected)
  expect(totals(selected)).toEqual({ income, expense, balance: income - expense })
  const csv = createReportCsv(`MeMoney-${period}-${start}.csv`, selected, '$')
  expect(csv.name).toBe(`MeMoney-${period}-${start}.csv`)
  const content = await csv.text()
  expect(content.split('\r\n').filter(Boolean)).toHaveLength(expected.length + 1)
  for (const date of dates) expect(content.includes(`Entry ${date}`)).toBe(expected.includes(date))
  expect(content).toContain('"Expense","Food",')
  expect(content).toContain('"Yes",-3.00,"$"')
  if (period === 'week') expect(content).toContain('"Income","Salary","Entry 2026-09-28","No",2.00,"$"')
  const draw = vi.spyOn(PDFPage.prototype, 'drawText')
  try {
    const file = await createReportPdf(label, `MeMoney-${period}-${start}.pdf`, selected, '$')
    expect(file.name).toBe(`MeMoney-${period}-${start}.pdf`)
    const document = await PDFDocument.load(await file.arrayBuffer())
    expect(document.getPageCount()).toBeGreaterThan(0)
    const text = draw.mock.calls.map(([value]) => value).join('\n')
    expect(text).toContain(label)
    for (const date of dates) expect(text.includes(`Entry ${date}`)).toBe(expected.includes(date))
  } finally { draw.mockRestore() }
})
