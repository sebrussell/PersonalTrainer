import { describe, expect, it } from 'vitest'
import { buildRecommendation } from './scheduler'

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
          intensities: [{ label: 'Short swim', duration: 30, commitment: 35 }],
        },
        {
          name: 'Walking',
          priority: 2,
          targetFrequency: 4,
          travelMinutes: 5,
          intensities: [{ label: 'Walk', duration: 30, commitment: 30 }],
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
  })
})
