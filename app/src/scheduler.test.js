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
