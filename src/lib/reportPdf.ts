import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { category } from './categories'
import { money } from './format'
import { totals } from './store'
import type { Tx } from './types'

const PAGE: [number, number] = [595.28, 841.89] // A4 in points
const LEFT = 40
const RIGHT = PAGE[0] - LEFT
const INK = rgb(0.08, 0.08, 0.1)
const MUTED = rgb(0.42, 0.42, 0.45)
const LINE = rgb(0.83, 0.83, 0.85)

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    if (font.widthOfTextAtSize(line + segment, size) > width && line) {
      lines.push(line)
      line = segment
    } else line += segment
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

export async function createReportPdf(label: string, filename: string, transactions: Tx[], symbol: string): Promise<File> {
  const pdfSymbol = symbol === '₫' ? 'VND ' : symbol
  const response = await fetch('/fonts/NotoSansThai.ttf')
  if (!response.ok) throw new Error('Could not load the report font.')
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(await response.arrayBuffer())
  let page: PDFPage
  let y = 0
  let pageNumber = 0
  const addPage = () => {
    page = pdf.addPage(PAGE)
    pageNumber++
    y = PAGE[1] - 48
    page.drawText('MeMoney', { x: LEFT, y, size: 18, font, color: INK })
    page.drawText(label, { x: LEFT, y: y - 20, size: 10, font, color: MUTED })
    page.drawText(String(pageNumber), { x: RIGHT - 12, y, size: 9, font, color: MUTED })
    y -= 46
    page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.6, color: LINE })
    y -= 25
  }
  addPage()

  const { income, expense, balance } = totals(transactions)
  for (const [title, amount] of [['Income', income], ['Expenses', expense], ['Net', balance]] as const) {
    page!.drawText(title, { x: LEFT, y, size: 10, font, color: MUTED })
    const value = `${amount < 0 ? '−' : ''}${money(Math.abs(amount), pdfSymbol)}`
    page!.drawText(value, { x: RIGHT - font.widthOfTextAtSize(value, 14), y: y - 2, size: 14, font, color: INK })
    y -= 30
  }
  y -= 14
  const header = () => {
    page!.drawText('Date', { x: LEFT, y, size: 9, font, color: MUTED })
    page!.drawText('Transaction', { x: LEFT + 82, y, size: 9, font, color: MUTED })
    page!.drawText('Receipt', { x: RIGHT - 144, y, size: 9, font, color: MUTED })
    page!.drawText('Amount', { x: RIGHT - 50, y, size: 9, font, color: MUTED })
    y -= 12
    page!.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.6, color: LINE })
    y -= 17
  }
  header()
  if (!transactions.length) {
    page!.drawText('No transactions for this period', { x: LEFT, y, size: 10, font, color: MUTED })
  }
  for (const tx of transactions) {
    const title = tx.merchant || category(tx.category).label
    const detail = `${category(tx.category).label}${tx.note ? ` · ${tx.note}` : ''}`
    const titleLines = wrap(title, font, 10, 226)
    const detailLines = wrap(detail, font, 8, 226)
    const height = Math.max(40, titleLines.length * 13 + detailLines.length * 11 + 12)
    if (y - height < 48) { addPage(); header() }
    page!.drawText(tx.date, { x: LEFT, y, size: 9, font, color: INK })
    titleLines.forEach((line, i) => page!.drawText(line, { x: LEFT + 82, y: y - i * 13, size: 10, font, color: INK }))
    detailLines.forEach((line, i) => page!.drawText(line, { x: LEFT + 82, y: y - titleLines.length * 13 - i * 11, size: 8, font, color: MUTED }))
    page!.drawText(tx.photoAt ? 'Yes' : '—', { x: RIGHT - 144, y, size: 9, font, color: MUTED })
    const value = `${tx.type === 'income' ? '+' : '−'}${money(tx.amount, pdfSymbol)}`
    page!.drawText(value, { x: RIGHT - font.widthOfTextAtSize(value, 9), y, size: 9, font, color: INK })
    y -= height
    page!.drawLine({ start: { x: LEFT, y: y + 5 }, end: { x: RIGHT, y: y + 5 }, thickness: 0.4, color: LINE })
  }
  const bytes = await pdf.save()
  return new File([new Uint8Array(bytes)], filename, { type: 'application/pdf' })
}
