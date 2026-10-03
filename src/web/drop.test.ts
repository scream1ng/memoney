import { afterEach, expect, it, vi } from 'vitest'
import { acceptsDrop } from './drop'

const drag = (types: string[]) => ({ dataTransfer: { types } as unknown as DataTransfer })
const withDialog = (open: boolean) => vi.stubGlobal('document', { querySelector: () => (open ? {} : null) })
afterEach(() => vi.unstubAllGlobals())

it('takes a file drag over the page', () => {
  withDialog(false)
  expect(acceptsDrop(drag(['Files']))).toBe(true)
})

it('ignores a file drag while a dialog is open, so the overlay never promises a drop that is ignored', () => {
  withDialog(true)
  expect(acceptsDrop(drag(['Files']))).toBe(false)
})

it('ignores dragged text and links', () => {
  withDialog(false)
  expect(acceptsDrop(drag(['text/plain']))).toBe(false)
  expect(acceptsDrop({ dataTransfer: null })).toBe(false)
})
