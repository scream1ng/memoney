import { expect, it } from 'vitest'
import { createReportCsv } from './reportCsv'
import type { Tx } from './types'

const tx: Tx = { id: '1', type: 'expense', amount: 450, category: 'food', date: '2026-10-01', merchant: 'Cafe, "One"', note: 'กาแฟ\nCoffee', createdAt: 1 }

it('exports signed decimal amounts and escaped multilingual fields', async () => {
  const file = createReportCsv('month.csv', [tx, { ...tx, type: 'income', amount: 100000, note: '=1+1' }], '$')
  expect(file.name).toBe('month.csv')
  expect(file.type).toBe('text/csv;charset=utf-8')
  expect([...new Uint8Array(await file.arrayBuffer()).slice(0, 3)]).toEqual([239, 187, 191])
  const text = await file.text()
  expect(text).toContain('"Cafe, ""One"""')
  expect(text).toContain('"กาแฟ\nCoffee"')
  expect(text).toContain(',-4.50,"$"\r\n')
  expect(text).toContain(',1000.00,"$"\r\n')
  expect(text).toContain('"\'=1+1"')
})

it('exports column headers for an empty period', async () => {
  expect(await createReportCsv('empty.csv', [], '฿').text()).toBe('Date,Type,Category,Merchant,Note,Receipt,Amount,Currency\r\n')
})
