import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { category } from './categories'
import { money } from './format'
import { totals } from './store'
import type { Tx } from './types'

const PAGE: [number, number] = [595.28, 841.89] // Portrait A4 in points
const LEFT = 28
const RIGHT = PAGE[0] - LEFT
const INK = rgb(0.08, 0.08, 0.1)
const MUTED = rgb(0.42, 0.42, 0.45)
const LINE = rgb(0.83, 0.83, 0.85)

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    if (/^[\r\n]+$/.test(segment)) { lines.push(line); line = ''; continue }
    if (font.widthOfTextAtSize(line + segment, size) > width && line) {
      const space = line.lastIndexOf(' ')
      if (space > 0) {
        lines.push(line.slice(0, space))
        line = (line.slice(space + 1) + segment).trimStart()
      } else {
        lines.push(line)
        line = segment.trimStart()
      }
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
  const summaryWidth = (RIGHT - LEFT) / 3
  let summaryHeight = 0
  for (const [i, [title, amount]] of ([['Income', income], ['Expenses', expense], ['Net', balance]] as const).entries()) {
    const x = LEFT + i * summaryWidth
    page!.drawText(title, { x, y, size: 16, font, color: MUTED })
    const value = `${amount < 0 ? '−' : ''}${money(Math.abs(amount), pdfSymbol)}`
    const lines = wrap(value, font, 22, summaryWidth - 12)
    lines.forEach((line, j) => page!.drawText(line, { x, y: y - 30 - j * 28, size: 22, font, color: INK }))
    summaryHeight = Math.max(summaryHeight, lines.length * 28)
  }
  y -= 46 + summaryHeight
  const header = () => {
    page!.drawText('Transactions', { x: LEFT, y, size: 18, font, color: MUTED })
    y -= 16
    page!.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.6, color: LINE })
  }
  header()
  if (!transactions.length) {
    page!.drawText('No transactions for this period', { x: LEFT, y: y - 32, size: 18, font, color: MUTED })
  }
  for (const tx of transactions) {
    const amountWidth = 190
    const titleLines = wrap(category(tx.category).label, font, 22, RIGHT - LEFT - amountWidth - 16)
    const value = `${tx.type === 'income' ? '+' : '−'}${money(tx.amount, pdfSymbol)}`
    const amountLines = wrap(value, font, 22, amountWidth)
    const meta = `${tx.type === 'income' ? 'Income' : 'Expense'} · ${tx.date} · Receipt: ${tx.photoAt ? 'Yes' : 'No'}`
    const metaLines = wrap(meta, font, 18, RIGHT - LEFT)
    const noteLines = wrap(`Note: ${tx.note || '—'}`, font, 20, RIGHT - LEFT)
    const mainHeight = Math.max(titleLines.length, amountLines.length) * 28
    const fixedHeight = 16 + font.heightAtSize(22, { descender: false }) + mainHeight + metaLines.length * 24 + 8
    let offset = 0
    do {
      const remainingHeight = fixedHeight + (noteLines.length - offset) * 26 + 8
      if (y - Math.min(remainingHeight, fixedHeight + 26 + 8) < 48 ||
        (offset === 0 && remainingHeight <= PAGE[1] - 183 && y - remainingHeight < 48)) {
        addPage(); header()
      }
      const textY = y - 16 - font.heightAtSize(22, { descender: false })
      titleLines.forEach((line, i) => page!.drawText(line, { x: LEFT, y: textY - i * 28, size: 22, font, color: INK }))
      amountLines.forEach((line, i) => page!.drawText(line, { x: RIGHT - font.widthOfTextAtSize(line, 22), y: textY - i * 28, size: 22, font, color: INK }))
      const metaY = textY - mainHeight
      metaLines.forEach((line, i) => page!.drawText(line, { x: LEFT, y: metaY - i * 24, size: 18, font, color: MUTED }))
      const noteY = metaY - metaLines.length * 24 - 8
      const count = Math.max(1, Math.floor((noteY - 48 - 8) / 26))
      const lines = noteLines.slice(offset, offset + count)
      lines.forEach((line, i) => page!.drawText(line, { x: LEFT, y: noteY - i * 26, size: 20, font, color: INK }))
      offset += lines.length
      y = noteY - lines.length * 26 - 8
      page!.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.4, color: LINE })
      if (offset < noteLines.length) { addPage(); header() }
    } while (offset < noteLines.length)
  }
  const bytes = await pdf.save()
  return new File([new Uint8Array(bytes)], filename, { type: 'application/pdf' })
}
