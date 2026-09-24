export const defaultGoals = [
  {
    name: 'Climbing',
    activity: 'Climbing',
    priority: 5,
    targetFrequency: 2,
    minimumFrequency: 1,
    travelMinutes: 45,
    muscles: ['Back', 'Shoulders', 'Grip', 'Core'],
    minDuration: 60,
    maxDuration: 120,
  },
  {
    name: 'Swimming',
    activity: 'Swimming',
    priority: 3,
    targetFrequency: 1,
    minimumFrequency: 1,
    travelMinutes: 25,
    muscles: ['Shoulders', 'Core', 'Legs'],
    minDuration: 30,
    maxDuration: 60,
  },
  {
    name: 'Running',
    activity: 'Running',
    priority: 4,
    targetFrequency: 3,
    minimumFrequency: 1,
    travelMinutes: 15,
    muscles: ['Legs', 'Core'],
    minDuration: 20,
    maxDuration: 60,
  },
  {
    name: 'Walking',
    activity: 'Walking',
    priority: 2,
    targetFrequency: 4,
    minimumFrequency: 2,
    travelMinutes: 5,
    muscles: ['Legs', 'Core'],
    minDuration: 15,
    maxDuration: 60,
  },
  {
    name: 'Cycling',
    activity: 'Cycling',
    priority: 2,
    targetFrequency: 1,
    minimumFrequency: 1,
    travelMinutes: 20,
    muscles: ['Legs', 'Core'],
    minDuration: 30,
    maxDuration: 90,
  },
  {
    name: 'Weight training',
    activity: 'Weight training',
    priority: 4,
    targetFrequency: 2,
    minimumFrequency: 1,
    travelMinutes: 15,
    muscles: ['Chest', 'Back', 'Shoulders', 'Legs'],
    minDuration: 30,
    maxDuration: 90,
  },
  {
    name: 'Yoga',
    activity: 'Yoga',
    priority: 2,
    targetFrequency: 2,
    minimumFrequency: 1,
    travelMinutes: 10,
    muscles: ['Core', 'Back', 'Legs'],
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

  const last = recentActivity.find((item) => matchGoal({ name: item.activity }, candidateType))
  const daysAgo = last?.daysAgo ?? relevantGoal.targetFrequency * 4 + 4
  const overdue = Math.max(0, daysAgo - 3)
  return Math.min(180, overdue * 8 + relevantGoal.priority * 12)
}

function getTotalTime(candidate) {
  const duration = Number(candidate?.duration ?? 0)
  const travelMinutes = Number(candidate?.travelMinutes ?? 0)
  return duration + travelMinutes
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

      return {
        id: normalizeName(exercise.name),
        title: exercise.name,
        duration: Math.min(maxDuration, Math.max(minDuration, availableExerciseMinutes)),
        minDuration,
        maxDuration,
        exerciseName: exercise.name,
        activity: exercise.activity || exercise.name,
        travelMinutes,
        muscles: exercise.muscles || [],
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
      const value = String(entry).toLowerCase()
      return value === 'anything' || value === String(candidate.exerciseName || '').toLowerCase() || value === String(candidate.activity || '').toLowerCase()
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

    const sorenessPenalty = recovery?.soreness ?? {}
    const soreKey = Object.entries(sorenessPenalty).find(([, value]) => value === 'very-sore' || value === 'quite-sore')
    if (soreKey && ['Running', 'Weight training', 'Climbing'].includes(candidate.exerciseName)) {
      score -= 20
      breakdown['Recovery soreness'] = -20
      reasonBits.push('your recovery is still a bit behind')
    }

    const timeFit = Math.max(0, 18 - Math.abs(candidate.duration - safeAvailable) / 4)
    score += timeFit
    breakdown['Duration fit'] = timeFit

    const musclePreference = musclePreferences?.[0]
    if (musclePreference && musclePreference !== 'no-preference' && musclePreference !== 'full-body') {
      const matchesExerciseMuscle = (candidate.muscles || []).some(
        (muscle) => muscle.toLowerCase() === musclePreference.toLowerCase(),
      )
      if (matchesExerciseMuscle) {
        score += 8
        breakdown['Muscle match'] = 8
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

    return { ...candidate, score, breakdown, calculation: `${calculation} = ${score}`, reason: explanation }
  })

  const validCandidates = scored.filter((candidate) => candidate.id === 'rest' || getTotalTime(candidate) <= safeAvailable)
  const debug = [...scored].sort((a, b) => b.score - a.score).map((candidate) => ({
    title: candidate.title,
    score: candidate.score,
    valid: candidate.id === 'rest' || getTotalTime(candidate) <= safeAvailable,
    breakdown: candidate.breakdown || {},
    calculation: candidate.calculation || `${candidate.score} = ${candidate.score}`,
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
