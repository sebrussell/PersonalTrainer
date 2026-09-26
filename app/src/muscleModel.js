export const muscleAreas = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Grip']

export function clampScaleValue(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.min(1, Math.max(0, numericValue)) : 0
}

export function getMuscleUse(muscleUse, area) {
  const entry = Object.entries(muscleUse || {}).find(([name]) => (
    name.trim().toLowerCase() === String(area).trim().toLowerCase()
  ))
  return entry ? clampScaleValue(entry[1]) : 0
}

export function normalizeMuscleUse(muscleUse, fallback = {}) {
  return Object.fromEntries(muscleAreas.map((area) => {
    const value = Object.prototype.hasOwnProperty.call(muscleUse || {}, area)
      ? muscleUse[area]
      : fallback[area]
    return [area, clampScaleValue(value)]
  }))
}

export function legacyMuscleUse(muscles = []) {
  const selected = new Set(muscles.map((area) => String(area).trim().toLowerCase()))
  return Object.fromEntries(muscleAreas.map((area) => [
    area,
    selected.has(area.toLowerCase()) ? 1 : 0,
  ]))
}

export function getSorenessValue(value) {
  if (typeof value === 'number') {
    return clampScaleValue(value)
  }

  const legacyValues = {
    'not-sore': 0,
    'a-little-sore': 0.5,
    sore: 1,
    'quite-sore': 1,
    'very-sore': 1,
  }
  return legacyValues[String(value || '').trim().toLowerCase()] ?? clampScaleValue(value)
}