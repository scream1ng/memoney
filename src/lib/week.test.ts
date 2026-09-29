import { expect, it } from 'vitest'
import { shiftWeek, weekStart } from './format'
import { forWeek } from './store'
import type { Tx } from './types'

it('keeps a Monday–Sunday week together across a month boundary', () => {
  const week = weekStart('2026-10-01')
  expect(week).toBe('2026-09-28')
  expect(shiftWeek(week, 1)).toBe('2026-10-05')
  const txs = ['2026-09-27', '2026-09-28', '2026-10-04', '2026-10-05']
    .map((date, createdAt) => ({ id: date, date, createdAt })) as Tx[]
  expect(forWeek(txs, week).map((tx) => tx.date)).toEqual(['2026-10-04', '2026-09-28'])
})
