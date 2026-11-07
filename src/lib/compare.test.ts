import { describe, expect, it } from 'vitest'
import { swipeStep } from '../hooks/usePeriodSwipe'
import { damp, PULL_TRIGGER } from '../hooks/usePullRefresh'
import { inRange, previousRange, search } from './store'
import type { Tx } from './types'

const tx = (date: string, extra: Partial<Tx> = {}): Tx => ({ id: date + (extra.note ?? ''), type: 'expense', amount: 100, category: 'food', date, createdAt: 1, ...extra })

describe('previous period to compare against', () => {
  it('compares only the days elapsed while the month is still running', () => {
    expect(previousRange('month', '2026-11', '2026-11-07')).toMatchObject({ start: '2026-10-01', end: '2026-10-08' })
  })
  it('compares whole months once the month is over, including short ones', () => {
    expect(previousRange('month', '2026-10', '2026-11-07')).toMatchObject({ start: '2026-09-01', end: '2026-10-01' })
    // 31 March running to the 31st compares against all of February, not past it
    expect(previousRange('month', '2026-03', '2026-03-31')).toMatchObject({ start: '2026-02-01', end: '2026-03-01' })
  })
  it('handles weeks and days', () => {
    expect(previousRange('week', '2026-11-02', '2026-11-04')).toMatchObject({ start: '2026-10-26', end: '2026-10-29' })
    expect(previousRange('week', '2026-10-26', '2026-11-07')).toMatchObject({ start: '2026-10-19', end: '2026-10-26' })
    expect(previousRange('day', '2026-11-07', '2026-11-07')).toMatchObject({ start: '2026-11-06', end: '2026-11-07' })
  })
  it('selects entries inside the range only', () => {
    const r = previousRange('month', '2026-11', '2026-11-07')
    expect(inRange([tx('2026-09-30'), tx('2026-10-01'), tx('2026-10-07'), tx('2026-10-08')], r).map((t) => t.date)).toEqual(['2026-10-01', '2026-10-07'])
  })
})

describe('search', () => {
  it('matches shop, note or category name across all dates, newest first, ignoring case', () => {
    const all = [tx('2026-10-24', { merchant: '7-Eleven' }), tx('2026-11-03', { note: 'coffee at 7-eleven' }), tx('2026-11-05', { merchant: 'BTS', category: 'transport' })]
    expect(search(all, ' 7-ELEVEN ').map((t) => t.date)).toEqual(['2026-11-03', '2026-10-24'])
    expect(search(all, 'transport').map((t) => t.date)).toEqual(['2026-11-05'])
    expect(search(all, '   ')).toEqual([])
  })
})

describe('gestures', () => {
  it('steps the period only for a clear sideways swipe', () => {
    expect(swipeStep(-80, 10)).toBe(1)
    expect(swipeStep(80, -10)).toBe(-1)
    expect(swipeStep(-40, 0)).toBe(0) // too short: a tap or wobble
    expect(swipeStep(-80, 60)).toBe(0) // mostly vertical: a scroll
  })
  it('needs a deliberate pull to refresh', () => {
    expect(damp(-50)).toBe(0)
    expect(damp(100)).toBeLessThan(PULL_TRIGGER)
    expect(damp(140)).toBeGreaterThanOrEqual(PULL_TRIGGER)
    expect(damp(1000)).toBe(96)
  })
})
