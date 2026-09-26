import { describe, expect, it } from 'vitest'
import { getGoalProgress } from './progress'
import { defaultGoals } from './scheduler'

describe('getGoalProgress', () => {
  const now = new Date(2026, 0, 15, 12)

  it('counts the rolling fortnight against fortnight targets', () => {
    const progress = getGoalProgress([
      { name: 'Weight training', targetFrequencyFortnight: 6, targetMinutesFortnight: 180 },
    ], [
      { activity: 'Weight training', completedAt: new Date(2026, 0, 2, 10).toISOString(), duration: 30 },
      { activity: 'Weight training', completedAt: new Date(2026, 0, 1, 10).toISOString(), duration: 30 },
      { activity: 'Weight training', completedAt: new Date(2026, 0, 15, 10).toISOString(), duration: 30 },
    ], { period: 'fortnight', now })

    expect(progress[0]).toMatchObject({
      sessions: 2,
      targetSessions: 6,
      completedMinutes: 60,
      targetMinutes: 180,
    })
  })

  it('allows a fortnight target to differ from twice the weekly target', () => {
    const progress = getGoalProgress([
      { name: 'Swimming', targetFrequency: 1, targetFrequencyFortnight: 1, targetMinutesFortnight: 90 },
    ], [], { period: 'fortnight', now })

    expect(progress[0]).toMatchObject({ targetSessions: 1, targetMinutes: 90 })
  })

  it('treats a cleared fortnight session target as disabled', () => {
    const progress = getGoalProgress([
      { name: 'Swimming', targetFrequency: 1, targetFrequencyFortnight: null },
    ], [], { period: 'fortnight', now })

    expect(progress[0].targetSessions).toBe(0)
  })

  it('matches activities without being sensitive to surrounding whitespace', () => {
    const progress = getGoalProgress([
      { name: 'Strength day', activity: '  Weight training  ', targetFrequencyFortnight: 3 },
    ], [
      { activity: 'Weight training', completedAt: new Date(2026, 0, 15, 10).toISOString(), duration: 45 },
    ], { period: 'fortnight', now })

    expect(progress[0].sessions).toBe(1)
  })

  it('keeps weekly progress within the current Monday-to-Sunday week', () => {
    const progress = getGoalProgress([
      { name: 'Weight training', targetFrequencyFortnight: 6 },
    ], [
      { activity: 'Weight training', completedAt: new Date(2026, 0, 11, 10).toISOString() },
      { activity: 'Weight training', completedAt: new Date(2026, 0, 12, 10).toISOString() },
    ], { period: 'week', now })

    expect(progress[0]).toMatchObject({ sessions: 1, targetSessions: 3 })
  })

  it('does not use weekly-only fields as progress targets', () => {
    const progress = getGoalProgress([
      { name: 'Swimming', targetFrequency: 1, targetMinutes: 60 },
    ], [], { period: 'fortnight', now })

    expect(progress[0]).toMatchObject({ targetSessions: 0, targetMinutes: null })
  })

  it('does not infer a minutes target from session length or frequency', () => {
    const progress = getGoalProgress([
      { name: 'Climbing', targetFrequencyFortnight: 4, minDuration: 60, maxDuration: 120 },
    ], [], { period: 'fortnight', now })

    expect(progress[0]).toMatchObject({ targetSessions: 4, targetMinutes: null })
  })

  it('ships no minute target for climbing but preserves the walking time goal', () => {
    const progress = getGoalProgress(defaultGoals, [], { period: 'fortnight', now })
    const climbing = progress.find((goal) => goal.name === 'Climbing')
    const walking = progress.find((goal) => goal.name === 'Walking')

    expect(climbing.targetMinutes).toBeNull()
    expect(walking.targetMinutes).toBe(360)
  })
})