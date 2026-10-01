import { category } from './categories'
import type { Tx } from './types'

function cell(value: string): string {
  const safe = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function createReportCsv(filename: string, transactions: Tx[], symbol: string): File {
  const rows = ['Date,Type,Category,Note,Receipt,Amount,Currency']
  for (const tx of transactions) {
    rows.push([
      ...[tx.date, tx.type === 'income' ? 'Income' : 'Expense', category(tx.category).label, tx.note ?? '', tx.photoAt ? 'Yes' : 'No'].map(cell),
      (tx.amount / 100 * (tx.type === 'income' ? 1 : -1)).toFixed(2),
      cell(symbol),
    ].join(','))
  }
  return new File(['\uFEFF' + rows.join('\r\n') + '\r\n'], filename, { type: 'text/csv;charset=utf-8' })
}
