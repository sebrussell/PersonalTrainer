import { describe, expect, it } from 'vitest'
import { formatAvailableTime, formatTodayDate } from './displayFormat'

describe('display formatting', () => {
  it('uses an all-day label instead of the internal 480-minute value', () => {
    expect(formatAvailableTime(480)).toBe('all day')
    expect(formatAvailableTime(60)).toBe('60 minutes')
  })

  it('formats the actual current date for the header', () => {
    expect(formatTodayDate(new Date(2026, 8, 26))).toBe('Saturday 26 September')
  })
})