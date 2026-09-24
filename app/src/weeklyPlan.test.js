import { describe, expect, it } from 'vitest'
import { buildWeeklyPlan } from './weeklyPlan'

describe('buildWeeklyPlan', () => {
  it('covers repeated targets fairly and uses pre-work slots when they fit', () => {
    const plan = buildWeeklyPlan({
      goals: [
        { name: 'Running', priority: 4, targetFrequency: 3, minDuration: 20, maxDuration: 60, travelMinutes: 15 },
        { name: 'Yoga', priority: 1, targetFrequency: 1, minDuration: 20, maxDuration: 60, travelMinutes: 10 },
      ],
      progress: [
        { name: 'Running', sessions: 0 },
        { name: 'Yoga', sessions: 0 },
      ],
      slots: [
        { id: 'mon-pre', day: 'Monday', label: 'Pre-work', minutes: 45, likelihood: 'medium' },
        { id: 'tue-post', day: 'Tuesday', label: 'Post-work', minutes: 120, likelihood: 'high' },
        { id: 'wed-pre', day: 'Wednesday', label: 'Pre-work', minutes: 45, likelihood: 'medium' },
        { id: 'thu-post', day: 'Thursday', label: 'Post-work', minutes: 60, likelihood: 'high' },
      ],
    })

    const running = plan.filter((item) => item.goalName === 'Running')
    expect(running).toHaveLength(3)
    expect(running.some((item) => item.label === 'Pre-work')).toBe(true)
    expect(running[0].rationale).toContain('Target 3: this is the 1st Running session')
    expect(plan.some((item) => item.goalName === 'Yoga')).toBe(true)
  })

  it('can share one availability slot between different exercises', () => {
    const plan = buildWeeklyPlan({
      goals: [
        { name: 'Running', priority: 4, targetFrequency: 1, minDuration: 20, maxDuration: 60, travelMinutes: 15 },
        { name: 'Yoga', priority: 1, targetFrequency: 1, minDuration: 20, maxDuration: 60, travelMinutes: 10 },
      ],
      progress: [
        { name: 'Running', sessions: 0 },
        { name: 'Yoga', sessions: 0 },
      ],
      slots: [
        { id: 'mon-post', day: 'Monday', label: 'Post-work', minutes: 120, likelihood: 'high' },
      ],
    })

    expect(plan).toHaveLength(2)
    expect(new Set(plan.map((item) => item.slotId))).toEqual(new Set(['mon-post']))
  })

  it('uses a fitting pre-work slot before a later post-work slot', () => {
    const plan = buildWeeklyPlan({
      goals: [{ name: 'Running', priority: 4, targetFrequency: 1, minDuration: 20, maxDuration: 60, travelMinutes: 15 }],
      progress: [{ name: 'Running', sessions: 0 }],
      slots: [
        { id: 'mon-post', day: 'Monday', label: 'Post-work', minutes: 60, likelihood: 'high' },
        { id: 'mon-pre', day: 'Monday', label: 'Pre-work', minutes: 45, likelihood: 'medium' },
      ],
    })

    expect(plan[0]).toMatchObject({ day: 'Monday', label: 'Pre-work' })
  })

  it('fills remaining time for a single session without exceeding its maximum', () => {
    const plan = buildWeeklyPlan({
      goals: [{ name: 'Weight training', priority: 4, targetFrequency: 1, minDuration: 30, maxDuration: 90, travelMinutes: 15 }],
      progress: [{ name: 'Weight training', sessions: 0 }],
      slots: [{ id: 'mon-post', day: 'Monday', label: 'Post-work', minutes: 60, likelihood: 'high' }],
    })

    expect(plan[0]).toMatchObject({ duration: 45, totalTime: 60 })
  })

  it('numbers new sessions after completed sessions', () => {
    const plan = buildWeeklyPlan({
      goals: [{ name: 'Running', activity: 'Running', priority: 4, targetFrequency: 3, minDuration: 20, maxDuration: 60, travelMinutes: 15 }],
      progress: [{ name: 'Running', sessions: 1 }],
      slots: [{ id: 'wed-pre', day: 'Wednesday', label: 'Pre-work', minutes: 45, likelihood: 'medium' }],
    })

    expect(plan[0].rationale).toContain('Target 3: this is the 2nd Running session')
  })

  it('only uses today and future slots when replanning midweek', () => {
    const plan = buildWeeklyPlan({
      goals: [{ name: 'Running', priority: 4, targetFrequency: 3, minDuration: 20, maxDuration: 60, travelMinutes: 15 }],
      progress: [{ name: 'Running', sessions: 0 }],
      fromDayIndex: 2,
      slots: [
        { id: 'mon-post', day: 'Monday', label: 'Post-work', minutes: 60, likelihood: 'high' },
        { id: 'tue-post', day: 'Tuesday', label: 'Post-work', minutes: 60, likelihood: 'high' },
        { id: 'wed-pre', day: 'Wednesday', label: 'Pre-work', minutes: 45, likelihood: 'medium' },
        { id: 'thu-post', day: 'Thursday', label: 'Post-work', minutes: 60, likelihood: 'high' },
      ],
    })

    expect(plan.every((item) => ['Wednesday', 'Thursday'].includes(item.day))).toBe(true)
  })
})
