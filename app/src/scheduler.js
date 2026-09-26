import { getMuscleUse, getSorenessValue, normalizeMuscleUse } from './muscleModel'

export const defaultGoals = [
  {
    name: 'Climbing',
    activity: 'Climbing',
    priority: 5,
    targetFrequencyFortnight: 4,
    targetMinutesFortnight: null,
    travelMinutes: 45,
    muscleUse: { Chest: 0.1, Back: 0.9, Shoulders: 0.65, Arms: 0.35, Legs: 0.15, Core: 0.65, Grip: 1 },
    minDuration: 60,
    maxDuration: 120,
  },
  {
    name: 'Swimming',
    activity: 'Swimming',
    priority: 3,
    targetFrequencyFortnight: 1,
    targetMinutesFortnight: null,
    travelMinutes: 25,
    muscleUse: { Chest: 0.55, Back: 0.75, Shoulders: 0.8, Arms: 0.75, Legs: 0.2, Core: 0.5, Grip: 0.1 },
    minDuration: 30,
    maxDuration: 60,
  },
  {
    name: 'Running',
    activity: 'Running',
    priority: 4,
    targetFrequencyFortnight: 6,
    targetMinutesFortnight: null,
    travelMinutes: 15,
    muscleUse: { Chest: 0.05, Back: 0.1, Shoulders: 0.1, Arms: 0.3, Legs: 1, Core: 0.45, Grip: 0 },
    minDuration: 20,
    maxDuration: 60,
  },
  {
    name: 'Walking',
    activity: 'Walking',
    priority: 2,
    targetFrequencyFortnight: null,
    targetMinutesFortnight: 360,
    travelMinutes: 5,
    muscleUse: { Chest: 0, Back: 0.05, Shoulders: 0, Arms: 0.05, Legs: 0.3, Core: 0.1, Grip: 0 },
    minDuration: 15,
    maxDuration: 60,
  },
  {
    name: 'Cycling',
    activity: 'Cycling',
    priority: 2,
    targetFrequencyFortnight: 2,
    targetMinutesFortnight: null,
    travelMinutes: 20,
    muscleUse: { Chest: 0.05, Back: 0.25, Shoulders: 0.15, Arms: 0.1, Legs: 0.9, Core: 0.4, Grip: 0.05 },
    minDuration: 30,
    maxDuration: 90,
  },
  {
    name: 'Weight training',
    activity: 'Weight training',
    priority: 4,
    targetFrequencyFortnight: 6,
    targetMinutesFortnight: null,
    travelMinutes: 15,
    muscleUse: { Chest: 0.85, Back: 0.85, Shoulders: 0.75, Arms: 0.75, Legs: 0.85, Core: 0.65, Grip: 0.5 },
    minDuration: 30,
    maxDuration: 90,
  },
  {
    name: 'Yoga',
    activity: 'Yoga',
    priority: 2,
    targetFrequencyFortnight: 4,
    targetMinutesFortnight: null,
    travelMinutes: 10,
    muscleUse: { Chest: 0.15, Back: 0.45, Shoulders: 0.3, Arms: 0.35, Legs: 0.55, Core: 0.7, Grip: 0.05 },
    minDuration: 20,
    maxDuration: 60,
  },
]

const travelPenalty = {
  'no-travel': { Climbing: 90, Swimming: 40, Running: 0, 'Weight training': 0, Walking: 0, Yoga: 0 },
  'prefer-home': { Climbing: 35, Swimming: 20, Running: 0, 'Weight training': 0, Walking: 0, Yoga: 0 },
  'dont-mind': { Climbing: 10, Swimming: 5, Running: 0, 'Weight training': 0, Walking: 0, Yoga: 0 },
  'happy-to-travel': { Climbing: 0, Swimming: 0, Running: 0, 'Weight training': 0, Walking: 0, Yoga: 0 },
}

const energyFit = {
  cooked: { Walking: 40, Running: 8, Yoga: 18, 'Weight training': -30, Swimming: -20, Climbing: -90, Rest: 52 },
  normal: { Walking: 18, Running: 24, Yoga: 12, 'Weight training': 16, Swimming: 12, Climbing: 18, Rest: 8 },
  good: { Walking: 12, Running: 26, Yoga: 10, 'Weight training': 22, Swimming: 18, Climbing: 30, Rest: 4 },
  'full-of-energy': { Walking: 8, Running: 30, Yoga: 12, 'Weight training': 24, Swimming: 20, Climbing: 40, Rest: 3 },
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '-')
}

function normalizeExerciseKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function matchGoal(goal, candidateType) {
  if (!goal?.name) {
    return false
  }

  const goalKeys = [goal.id, goal.exerciseId, goal.name, goal.activity]
    .filter(Boolean)
    .map((value) => normalizeExerciseKey(value))

  const candidateKey = normalizeExerciseKey(candidateType)

  return goalKeys.some((key) => key === candidateKey || candidateKey.includes(key) || key.includes(candidateKey))
}

function getMaintenanceDebt(goals, recentActivity, candidateType) {
  const relevantGoal = goals.find((goal) => matchGoal(goal, candidateType))
  if (!relevantGoal) {
    return 0
  }

  const targetFrequencyFortnight = Number(relevantGoal.targetFrequencyFortnight) || 0
  const last = recentActivity.find((item) => matchGoal({ name: item.activity }, candidateType))
  const daysAgo = last?.daysAgo ?? (targetFrequencyFortnight > 0 ? 14 / targetFrequencyFortnight + 4 : 12)
  const overdue = Math.max(0, daysAgo - 3)
  return Math.min(180, overdue * 8 + relevantGoal.priority * 12)
}

function getTotalTime(candidate) {
  const duration = Number(candidate?.duration ?? 0)
  const travelMinutes = Number(candidate?.travelMinutes ?? 0)
  return duration + travelMinutes
}

function getSorenessRisk(candidate, recovery) {
  return Object.entries(recovery?.soreness ?? {}).reduce((highest, [area, value]) => (
    Math.max(highest, getSorenessValue(value) * getMuscleUse(candidate.muscleUse, area))
  ), 0)
}

export function buildRecommendation({
  availableMinutes = 45,
  energy = 'normal',
  travelPreference = 'prefer-home',
  activityPreferences = ['anything'],
  musclePreferences = ['no-preference'],
  goals = defaultGoals,
  recentActivity = [],
  recovery = {},
  plannedExercises = [],
} = {}) {
  const safeAvailable = Number.isFinite(availableMinutes) ? Math.max(15, availableMinutes) : 45
  const baseExercisePool = Array.isArray(goals) && goals.length
    ? [
        ...defaultGoals.map((defaultGoal) => {
          const override = goals.find((goal) =>
            String(goal.name || '').toLowerCase() === String(defaultGoal.name || '').toLowerCase(),
          )
          return override ? { ...defaultGoal, ...override } : defaultGoal
        }),
        ...goals.filter((goal) => !defaultGoals.some((defaultGoal) =>
          String(defaultGoal.name || '').toLowerCase() === String(goal.name || '').toLowerCase(),
        )),
      ]
    : defaultGoals
  const activeGoals = Array.isArray(goals) && goals.length ? goals : defaultGoals

  const candidates = [
    { id: 'rest', title: 'Rest', duration: 0, travelMinutes: 0, exerciseName: 'Rest' },
    ...baseExercisePool.map((exercise) => {
      const travelMinutes = Number(exercise.travelMinutes || 0)
      const minDuration = Number(exercise.minDuration ?? exercise.duration ?? 45)
      const maxDuration = Math.max(minDuration, Number(exercise.maxDuration ?? exercise.duration ?? minDuration))
      const availableExerciseMinutes = Math.max(0, safeAvailable - travelMinutes)
      const muscleUse = normalizeMuscleUse(exercise.muscleUse)
      const sorenessRisk = getSorenessRisk({ muscleUse }, recovery)
      const availableDuration = Math.min(maxDuration, availableExerciseMinutes)
      const fittedDuration = Math.max(minDuration, availableDuration)
      const duration = Math.round(fittedDuration - ((fittedDuration - minDuration) * sorenessRisk))

      return {
        id: normalizeName(exercise.name),
        title: exercise.name,
        duration,
        minDuration,
        maxDuration,
        sorenessRisk,
        exerciseName: exercise.name,
        activity: String(exercise.activity || '').trim() || exercise.name,
        travelMinutes,
        muscleUse,
      }
    }),
  ]

  const scored = candidates.map((candidate) => {
    const preferenceList = activityPreferences.length ? activityPreferences : ['anything']
    const goalMatch = activeGoals.find((goal) => matchGoal(goal, candidate.exerciseName || candidate.activity || candidate.title))

    let score = 0
    const breakdown = {}
    const reasonBits = []

    if (candidate.id === 'rest') {
      const recoveryScore = energy === 'cooked' ? (safeAvailable < 30 ? 82 : 16) : 30
      breakdown['Recovery'] = recoveryScore
      return {
        ...candidate,
        score: recoveryScore,
        breakdown,
        calculation: `${recoveryScore} = ${recoveryScore}`,
        reason: 'Your body is signalling recovery today, so rest is a sensible option.',
      }
    }

    const totalTime = getTotalTime(candidate)
    const plannedToday = plannedExercises.some((activity) => (
      normalizeExerciseKey(activity) === normalizeExerciseKey(candidate.exerciseName || candidate.activity)
    ))
    if (plannedToday) {
      score += 28
      breakdown['Planned today'] = 28
      reasonBits.push('it is already planned for today')
    }

    const completedToday = recentActivity.some((item) => (
      item.daysAgo === 0
      && normalizeExerciseKey(item.activity) === normalizeExerciseKey(candidate.exerciseName || candidate.activity)
    ))
    if (completedToday) {
      breakdown['Completed today'] = -220
      reasonBits.push('you already completed it today')
    }

    if (totalTime > safeAvailable) {
      score -= 220
      breakdown['Time fit'] = -220
      reasonBits.push('it does not fit your available time')
    }

    const travelPenaltyValue = travelPenalty[travelPreference]?.[candidate.exerciseName] ?? 0
    const travelMinutesPenalty = Math.min(60, Number(candidate.travelMinutes || 0) / 2)
    const totalTravelPenalty = travelPenaltyValue + travelMinutesPenalty
    score -= totalTravelPenalty
    breakdown['Travel'] = -totalTravelPenalty
    if (totalTravelPenalty > 0) {
      reasonBits.push('travel and setup time matter for this session')
    }

    const energyBonus = energyFit[energy]?.[candidate.exerciseName] ?? 0
    score += energyBonus
    breakdown['Energy fit'] = energyBonus
    if (energyBonus < 0) {
      reasonBits.push('your energy is not well matched to this kind of session')
    }

    const matchTarget = preferenceList.some((entry) => {
      const value = String(entry).trim().toLowerCase()
      return value === 'anything'
        || value === String(candidate.exerciseName || '').trim().toLowerCase()
        || value === String(candidate.activity || '').trim().toLowerCase()
    })

    if (matchTarget) {
      score += 24
      breakdown['Preference'] = 24
    } else if (preferenceList.length > 0) {
      score -= 12
      breakdown['Preference'] = -12
      reasonBits.push('it does not match what you fancy')
    }

    if (goalMatch) {
      const goalPriorityScore = goalMatch.priority * 8
      score += goalPriorityScore
      breakdown['Goal priority'] = goalPriorityScore
    }

    const maintenanceDebt = getMaintenanceDebt(activeGoals, recentActivity, candidate.exerciseName)
    if (maintenanceDebt > 0) {
      score += maintenanceDebt
      breakdown['Maintenance debt'] = maintenanceDebt
      reasonBits.push('this is overdue and a key priority for you')
    }

    const recent = recentActivity.find((item) => item.activity && String(item.activity).toLowerCase() === String(candidate.exerciseName || '').toLowerCase())
    if (recent && recent.daysAgo && recent.daysAgo >= 4) {
      score += 10
      breakdown['Recency'] = 10
    }
    if (recent && recent.daysAgo && recent.daysAgo <= 2 && candidate.exerciseName === 'Climbing') {
      score -= 18
      breakdown['Recency clamp'] = -18
    }

    if (candidate.exerciseName === 'Walking' && (energy === 'cooked' || safeAvailable <= 30)) {
      score += 22
      breakdown['Walk bonus'] = 22
    }
    if (candidate.exerciseName === 'Climbing' && safeAvailable < 120) {
      score -= 28
      breakdown['Short window penalty'] = -28
    }

    const sorenessRisk = candidate.sorenessRisk ?? getSorenessRisk(candidate, recovery)
    const sorenessBlocked = sorenessRisk >= 0.8
    const sorenessPenalty = sorenessBlocked ? -220 : -Math.round(sorenessRisk * 60)
    breakdown['Recovery soreness'] = sorenessPenalty
    score += sorenessPenalty
    if (sorenessBlocked) {
      reasonBits.push('soreness is high for the muscle load of this exercise')
    } else if (sorenessRisk > 0) {
      reasonBits.push('soreness and muscle load make this a less suitable choice today')
    }

    const timeFit = Math.max(0, 18 - Math.abs(candidate.duration - safeAvailable) / 4)
    score += timeFit
    breakdown['Duration fit'] = timeFit

    const musclePreference = musclePreferences?.[0]
    if (musclePreference && musclePreference !== 'no-preference' && musclePreference !== 'full-body') {
      const muscleMatchScore = Math.round(getMuscleUse(candidate.muscleUse, musclePreference) * 8)
      if (muscleMatchScore > 0) {
        score += muscleMatchScore
        breakdown['Muscle match'] = muscleMatchScore
      }
    }

    const explanation = buildReason({
      availableMinutes: safeAvailable,
      energy,
      travelPreference,
      activity: candidate.title,
      reasonBits,
      goalMatch,
      preferenceList,
      candidate,
    })

    const calculation = Object.values(breakdown).reduce(
      (expression, value) => `${expression} ${value >= 0 ? '+' : '-'} ${Math.abs(value)}`,
      '0',
    )

    return {
      ...candidate,
      score,
      breakdown,
      completedToday,
      sorenessBlocked,
      calculation: `${calculation} = ${score}`,
      reason: explanation,
    }
  })

  const validCandidates = scored.filter((candidate) => (
    candidate.id === 'rest'
    || (!candidate.completedToday && !candidate.sorenessBlocked && getTotalTime(candidate) <= safeAvailable)
  ))
  const debug = [...scored].sort((a, b) => b.score - a.score).map((candidate) => ({
    title: candidate.title,
    score: candidate.score,
    valid: candidate.id === 'rest' || (!candidate.completedToday && !candidate.sorenessBlocked && getTotalTime(candidate) <= safeAvailable),
    breakdown: candidate.breakdown || {},
    calculation: candidate.calculation || `${candidate.score} = ${candidate.score}`,
    sorenessRisk: candidate.sorenessRisk ?? 0,
  }))
  const sorted = validCandidates.sort((a, b) => b.score - a.score)
  const winner = sorted[0]
  const alternatives = sorted.filter((candidate) => candidate.id !== winner.id).slice(0, 3)

  return {
    title: winner.title,
    duration: winner.duration,
    totalTime: getTotalTime(winner),
    reason: winner.reason,
    alternatives: alternatives.map((item) => ({
      title: item.title,
      duration: item.duration,
      totalTime: getTotalTime(item),
      reason: item.reason,
    })),
    debug,
  }
}

function buildReason({ availableMinutes, energy, travelPreference, activity, reasonBits, goalMatch, preferenceList, candidate }) {
  const points = [`You have ${availableMinutes} minutes available`]

  if (energy === 'cooked') {
    points.push('you feel cooked')
  } else if (energy === 'good') {
    points.push('you still have some energy')
  } else {
    points.push('your energy is reasonable')
  }

  if (travelPreference === 'no-travel') {
    points.push('you do not want to travel')
  } else if (travelPreference === 'happy-to-travel') {
    points.push('you are happy to travel')
  }

  if (goalMatch) {
    points.push(`${goalMatch.name} is one of your priorities`)
  }

  if (preferenceList.some((entry) => entry === 'anything' || entry === String(candidate.exerciseName || '').toLowerCase())) {
    points.push('it matches what you fancy')
  }

  const priorityReason = reasonBits.find((bit) => /overdue|priority|maintenance/i.test(bit))
  if (priorityReason) {
    points.push(priorityReason)
  } else if (reasonBits.length) {
    points.push(reasonBits[0])
  }

  const prefix = candidate.exerciseName === 'Walking' ? 'A walk is the lowest-friction option' : `${activity} is a realistic fit for today`
  const suffix = 'This keeps the session practical and sustainable.'

  return `${prefix}. ${points.join(', ')}. ${suffix}`
}
