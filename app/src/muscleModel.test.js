import { describe, expect, it } from 'vitest'
import {
  clampScaleValue,
  getSorenessValue,
  legacyMuscleUse,
  muscleAreas,
  normalizeMuscleUse,
} from './muscleModel'

describe('muscle soreness scale', () => {
  it('migrates old categorical soreness values to the numeric scale', () => {
    expect(getSorenessValue('not-sore')).toBe(0)
    expect(getSorenessValue('a-little-sore')).toBe(0.5)
    expect(getSorenessValue('sore')).toBe(1)
  })

  it('clamps slider values and fills every muscle area', () => {
    expect(clampScaleValue(-0.2)).toBe(0)
    expect(clampScaleValue(1.2)).toBe(1)
    expect(normalizeMuscleUse({ Legs: 0.35 })).toEqual(Object.fromEntries(
      muscleAreas.map((area) => [area, area === 'Legs' ? 0.35 : 0]),
    ))
  })

  it('converts legacy binary muscle lists during settings migration', () => {
    expect(legacyMuscleUse(['Legs', 'Core'])).toMatchObject({ Legs: 1, Core: 1, Chest: 0 })
  })
})