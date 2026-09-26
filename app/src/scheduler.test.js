import { describe, expect, it } from 'vitest'
import { buildRecommendation, defaultGoals } from './scheduler'

describe('buildRecommendation', () => {
  it('prefers low-effort, travel-friendly options when energy is low', () => {
    const recommendation = buildRecommendation({
      availableMinutes: 45,
      energy: 'cooked',
      travelPreference: 'no-travel',
      activityPreferences: ['anything'],
      musclePreferences: ['no-preference'],
      goals: [
        { name: 'Running', priority: 3, targetFrequency: 2 },
        { name: 'Climbing', priority: 5, targetFrequency: 1 },
      ],
      recentActivity: [
        { activity: 'Running', daysAgo: 4 },
        { activity: 'Climbing', daysAgo: 1 },
      ],
    })

    expect(recommendation.title).toMatch(/Walk|Run|Strength/i)
    expect(recommendation.reason).toMatch(/travel|energy|time/i)
  })

  it('prefers an overdue priority session over a low-energy default when the user has fallen behind', () => {
    const recommendation = buildRecommendation({
      availableMinutes: 60,
      energy: 'cooked',
      travelPreference: 'no-travel',
      activityPreferences: ['anything'],
      musclePreferences: ['no-preference'],
      goals: [
        {
          name: 'Swimming',
          priority: 5,
          targetFrequency: 2,
          travelMinutes: 10,
          minDuration: 30,
          maxDuration: 30,
        },
        {
          name: 'Walking',
          priority: 2,
          targetFrequency: 4,
          travelMinutes: 5,
          minDuration: 30,
          maxDuration: 30,
        },
      ],
      recentActivity: [
        { activity: 'Swimming', daysAgo: 14 },
        { activity: 'Running', daysAgo: 4 },
        { activity: 'Walking', daysAgo: 1 },
      ],
    })

    expect(recommendation.title).toMatch(/Swim/i)
    expect(recommendation.reason).toMatch(/overdue|priority|maintenance/i)
  })

  it('prefers a higher-priority run over a lower-priority walk when time and energy are comfortable', () => {
    const recommendation = buildRecommendation({
      availableMinutes: 60,
      energy: 'good',
      travelPreference: 'prefer-home',
      activityPreferences: ['anything'],
      musclePreferences: ['no-preference'],
      goals: [
        { name: 'Running', priority: 4, targetFrequency: 3 },
        { name: 'Walking', priority: 2, targetFrequency: 4 },
      ],
      recentActivity: [
        { activity: 'Running', daysAgo: 4 },
        { activity: 'Walking', daysAgo: 1 },
      ],
    })

    expect(recommendation.title).toMatch(/Run/i)
    expect(recommendation.title).not.toMatch(/Walk/i)
    expect(Array.isArray(recommendation.debug)).toBe(true)
    expect(recommendation.debug[0]).toMatchObject({
      title: expect.any(String),
      score: expect.any(Number),
      breakdown: expect.any(Object),
      calculation: expect.stringContaining('='),
    })
  })

  it('does not recommend an exercise completed today', () => {
    const recommendation = buildRecommendation({
      availableMinutes: 60,
      energy: 'good',
      activityPreferences: ['running'],
      goals: [
        { name: 'Running', priority: 5, targetFrequency: 3, minDuration: 20, maxDuration: 60 },
        { name: 'Walking', priority: 1, targetFrequency: 2, minDuration: 20, maxDuration: 60 },
      ],
      recentActivity: [{ activity: 'Running', daysAgo: 0 }],
    })

    expect(recommendation.title).toBe('Walking')
    expect(recommendation.debug.find((item) => item.title === 'Running')).toMatchObject({
      valid: false,
      breakdown: { 'Completed today': -220 },
    })
  })

  it('gives a planned exercise a recommendation weighting', () => {
    const recommendation = buildRecommendation({
      availableMinutes: 60,
      energy: 'good',
      activityPreferences: ['anything'],
      goals: [
        { name: 'Running', priority: 2, targetFrequency: 2, minDuration: 20, maxDuration: 60 },
        { name: 'Walking', priority: 2, targetFrequency: 2, minDuration: 20, maxDuration: 60 },
      ],
      plannedExercises: ['Walking'],
    })

    const walking = recommendation.debug.find((item) => item.title === 'Walking')
    expect(walking.breakdown['Planned today']).toBe(28)
  })

  it('rejects sessions whose total commitment exceeds available time', () => {
    const recommendation = buildRecommendation({
      availableMinutes: 90,
      energy: 'good',
      travelPreference: 'happy-to-travel',
      activityPreferences: ['climbing'],
      musclePreferences: ['no-preference'],
      goals: [{ name: 'Climbing', priority: 5, targetFrequency: 2 }],
    })

    expect(recommendation.title).not.toContain('Climbing')
    const climbingDebug = recommendation.debug.find((item) => item.title === 'Climbing')
    expect(climbingDebug.valid).toBe(false)
  })

  it('uses the available time for flexible exercise lengths', () => {
    const recommendation = buildRecommendation({
      availableMinutes: 50,
      energy: 'good',
      travelPreference: 'happy-to-travel',
      activityPreferences: ['running'],
      goals: [{
        name: 'Running',
        priority: 4,
        targetFrequency: 3,
        travelMinutes: 10,
        minDuration: 20,
        maxDuration: 60,
      }],
    })

    expect(recommendation.title).toBe('Running')
    expect(recommendation.duration).toBe(40)
    expect(recommendation.totalTime).toBe(50)
  })

  it('scales sore-leg risk by each exercise muscle load', () => {
    const recommendation = buildRecommendation({
      availableMinutes: 120,
      energy: 'good',
      travelPreference: 'happy-to-travel',
      activityPreferences: ['anything'],
      recovery: { soreness: { Legs: 0.9 } },
      goals: defaultGoals,
    })

    const running = recommendation.debug.find((item) => item.title === 'Running')
    const swimming = recommendation.debug.find((item) => item.title === 'Swimming')
    const climbing = recommendation.debug.find((item) => item.title === 'Climbing')
    const walking = recommendation.debug.find((item) => item.title === 'Walking')

    expect(running.sorenessRisk).toBe(0.9)
    expect(running.valid).toBe(false)
    expect(running.breakdown['Recovery soreness']).toBe(-220)
    expect(swimming.sorenessRisk).toBeCloseTo(0.18)
    expect(swimming.valid).toBe(true)
    expect(swimming.breakdown['Recovery soreness']).toBe(-11)
    expect(climbing.sorenessRisk).toBeCloseTo(0.135)
    expect(climbing.valid).toBe(true)
    expect(climbing.breakdown['Recovery soreness']).toBe(-8)
    expect(walking.sorenessRisk).toBeCloseTo(0.27)
    expect(walking.valid).toBe(true)
    expect(walking.breakdown['Recovery soreness']).toBe(-16)
  })

  it('shortens the session and applies a gradual penalty at moderate soreness', () => {
    const recommendation = buildRecommendation({
      availableMinutes: 60,
      energy: 'good',
      travelPreference: 'happy-to-travel',
      activityPreferences: ['running'],
      recovery: { soreness: { Legs: 0.5 } },
      goals: [{
        name: 'Running',
        priority: 4,
        targetFrequency: 3,
        travelMinutes: 0,
        minDuration: 20,
        maxDuration: 60,
        muscleUse: { Legs: 1 },
      }],
    })

    const running = recommendation.debug.find((item) => item.title === 'Running')
    expect(recommendation.title).toBe('Running')
    expect(recommendation.duration).toBe(40)
    expect(recommendation.totalTime).toBe(40)
    expect(running.valid).toBe(true)
    expect(running.sorenessRisk).toBe(0.5)
    expect(running.breakdown['Recovery soreness']).toBe(-30)
  })
})
