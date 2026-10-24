import { describe, expect, it } from 'vitest'
import { formatDate, toIsoDate } from './dates'

describe('toIsoDate', () => {
  it('uses the local calendar day, never UTC', () => {
    // 00:30 local time: toISOString() would give the previous day east of UTC.
    expect(toIsoDate(new Date(2026, 9, 26, 0, 30))).toBe('2026-10-26')
  })
})

describe('formatDate', () => {
  it('formats YYYY-MM-DD as DD/MM/YYYY without going through Date', () => {
    expect(formatDate('2026-10-26')).toBe('26/10/2026')
  })
})
