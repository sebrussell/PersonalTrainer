import { describe, expect, it } from 'vitest'
import { defaultGoals, weightLiftingActivities } from './scheduler'
import { expandSavedGoal } from './goalMigration'

describe('expandSavedGoal', () => {
  it('splits saved weight-training targets and carries settings to the new lifts', () => {
    const migrated = expandSavedGoal({
      name: 'Weight training',
      activity: 'Weight training',
      priority: 5,
      targetFrequencyFortnight: 6,
      targetMinutesFortnight: 300,
      travelMinutes: 20,
      minDuration: 35,
      maxDuration: 75,
      muscles: ['Chest', 'Legs'],
    }, defaultGoals, weightLiftingActivities)

    expect(migrated.map((goal) => goal.name)).toEqual(weightLiftingActivities)
    expect(migrated.reduce((total, goal) => total + goal.targetFrequencyFortnight, 0)).toBe(6)
    expect(migrated.every((goal) => goal.targetMinutesFortnight === 60)).toBe(true)
    expect(migrated.every((goal) => goal.priority === 5 && goal.travelMinutes === 20)).toBe(true)
    expect(migrated.every((goal) => goal.minDuration === 35 && goal.maxDuration === 75)).toBe(true)
    expect(new Set(migrated.map((goal) => JSON.stringify(goal.muscleUse))).size).toBe(5)
  })

  it('leaves other saved exercises unchanged', () => {
    const savedGoal = { name: 'Swimming', targetFrequencyFortnight: 1 }
    expect(expandSavedGoal(savedGoal, defaultGoals, weightLiftingActivities)).toEqual([savedGoal])
  })
})