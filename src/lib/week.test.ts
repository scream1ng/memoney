import { expect, it } from 'vitest'
import { shiftDay, shiftWeek, weekStart } from './format'
import { forDay, forWeek } from './store'
import type { Tx } from './types'

it('keeps a Monday–Sunday week together across a month boundary', () => {
  const week = weekStart('2026-10-01')
  expect(week).toBe('2026-09-28')
  expect(shiftWeek(week, 1)).toBe('2026-10-05')
  const txs = ['2026-09-27', '2026-09-28', '2026-10-04', '2026-10-05']
    .map((date, createdAt) => ({ id: date, date, createdAt })) as Tx[]
  expect(forWeek(txs, week).map((tx) => tx.date)).toEqual(['2026-10-04', '2026-09-28'])
})

it('steps a day across a month boundary and keeps only that date', () => {
  expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01')
  expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30')
  const txs = ['2026-09-30', '2026-10-01', '2026-10-01', '2026-10-02']
    .map((date, createdAt) => ({ id: `${date}-${createdAt}`, date, createdAt })) as Tx[]
  expect(forDay(txs, '2026-10-01').map((tx) => tx.id)).toEqual(['2026-10-01-2', '2026-10-01-1'])
})
