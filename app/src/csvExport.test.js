import { describe, expect, it } from 'vitest'
import { createHistoryCsv, createSettingsCsv } from './csvExport'

describe('CSV exports', () => {
  it('exports session activity, duration, and completion time with CSV escaping', () => {
    const csv = createHistoryCsv([{
      activity: 'Ride, run "A"',
      duration: 30,
      completedAt: '2026-09-27T12:00:00.000Z',
    }])

    expect(csv).toBe([
      '"Activity","Duration (minutes)","Completed at"',
      '"Ride, run ""A""","30","2026-09-27T12:00:00.000Z"',
    ].join('\r\n'))
  })

  it('exports nested settings and protects spreadsheet formula values', () => {
    const csv = createSettingsCsv({
      activityPreferences: ['Walking', 'Yoga'],
      goals: [{ name: '=1+1', targetFrequencyFortnight: 2 }],
      recovery: { soreness: { legs: 0.5 } },
    })

    expect(csv).toBe([
      '"Preference","Value"',
      '"activityPreferences","Walking; Yoga"',
      '"goals[1].name","\'=1+1"',
      '"goals[1].targetFrequencyFortnight","2"',
      '"recovery.soreness.legs","0.5"',
    ].join('\r\n'))
  })
})