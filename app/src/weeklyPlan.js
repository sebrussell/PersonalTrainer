const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function getLikelihoodRank(value) {
  return value === 'high' ? 0 : value === 'medium' ? 1 : 2
}

function getSlotOrder(slot) {
  const label = String(slot.label || '').toLowerCase()
  const phase = label.includes('pre') ? 0 : label.includes('post') ? 1 : 0.5
  return dayOptions.indexOf(slot.day) * 2 + phase
}

function getGoalDuration(goal, slotMinutes) {
  const minDuration = Number(goal.minDuration ?? goal.duration ?? 45)
  const maxDuration = Math.max(minDuration, Number(goal.maxDuration ?? goal.duration ?? minDuration))
  const travelMinutes = Number(goal.travelMinutes || 0)
  const exerciseMinutes = Math.min(maxDuration, Math.max(minDuration, slotMinutes - travelMinutes))
  const plannedDuration = Math.min(minDuration, exerciseMinutes)

  return {
    duration: plannedDuration,
    totalTime: plannedDuration + travelMinutes,
  }
}

function getOrdinal(value) {
  const remainder = value % 100
  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`
  }

  return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`
}

export function buildWeeklyPlan({ goals, progress, slots, fromDayIndex = 0 }) {
  const progressByGoal = new Map(progress.map((item) => [String(item.name).toLowerCase(), item]))
  const orderedGoals = [...goals]
    .map((goal) => {
      const entry = progressByGoal.get(String(goal.name).toLowerCase()) || {}
      const targetSessions = Number(goal.targetFrequency) > 0 ? Number(goal.targetFrequency) : 0
      const targetMinutes = Number(goal.targetMinutes ?? 0)
      const completedSessions = Number(entry.sessions || 0)
      const completedMinutes = Number(entry.completedMinutes || 0)
      const remainingSessions = Math.max(0, targetSessions - completedSessions)
      const remainingMinutes = targetMinutes > 0 ? Math.max(0, targetMinutes - completedMinutes) : 0

      return {
        ...goal,
        completedSessions,
        completedMinutes,
        targetSessions,
        targetMinutes,
        remaining: targetSessions > 0 ? remainingSessions : remainingMinutes > 0 ? 1 : 0,
        remainingMinutes,
      }
    })
    .filter((goal) => goal.remaining > 0)
    .sort((first, second) => (Number(second.priority) || 0) - (Number(first.priority) || 0))
  const availableSlots = slots
    .map((slot, index) => ({ ...slot, id: slot.id || `slot-${index}` }))
    .filter((slot) => dayOptions.indexOf(slot.day) >= fromDayIndex)
  const slotUsage = new Map()
  const usedGoalDays = new Set()
  const scheduledByGoal = new Map()
  const assignments = []

  const chooseSlot = (goal, includeOptional, optionalOnly = false) => availableSlots
    .filter((slot) => (
      optionalOnly ? slot.likelihood === 'low' : includeOptional || slot.likelihood !== 'low'
    ))
    .filter((slot) => !usedGoalDays.has(`${goal.name}-${slot.day}`))
    .map((slot) => {
      const remainingMinutes = Number(slot.minutes || 0) - (slotUsage.get(slot.id) || 0)
      return { slot, timing: getGoalDuration(goal, remainingMinutes), remainingMinutes }
    })
    .filter(({ timing, remainingMinutes }) => timing.totalTime <= remainingMinutes)
    .sort((first, second) => (
      getSlotOrder(first.slot) - getSlotOrder(second.slot)
      || getLikelihoodRank(first.slot.likelihood) - getLikelihoodRank(second.slot.likelihood)
      || Math.abs(Number(first.slot.minutes) - first.timing.totalTime) - Math.abs(Number(second.slot.minutes) - second.timing.totalTime)
    ))[0]

  const addAssignment = (goal, selected, optional) => {
    const { slot, timing } = selected
    slotUsage.set(slot.id, (slotUsage.get(slot.id) || 0) + timing.totalTime)
    usedGoalDays.add(`${goal.name}-${slot.day}`)
    const sessionNumber = (goal.completedSessions || 0) + (scheduledByGoal.get(goal.name) || 0) + 1
    scheduledByGoal.set(goal.name, (scheduledByGoal.get(goal.name) || 0) + 1)
    assignments.push({
      id: `${slot.id}-${goal.name}`,
      slotId: slot.id,
      day: slot.day,
      dayIndex: dayOptions.indexOf(slot.day),
      label: slot.label,
      goalName: goal.name,
      activity: goal.activity || goal.name,
      duration: timing.duration,
      totalTime: timing.totalTime,
      optional,
      rationale: goal.targetSessions > 0
        ? `Target ${goal.targetSessions}: this is the ${getOrdinal(sessionNumber)} ${goal.activity || goal.name} session of the week.`
        : `Target ${goal.targetMinutes || 0} min: this helps you move toward your ${goal.activity || goal.name} time goal for the week.`,
    })
  }

  const remainingByGoal = new Map(orderedGoals.map((goal) => [goal.name, goal.remaining]))
  let placedSession = true
  while (placedSession) {
    placedSession = false
    orderedGoals.forEach((goal) => {
      if (!remainingByGoal.get(goal.name)) {
        return
      }

      const selected = chooseSlot(goal, false)
      if (selected) {
        addAssignment(goal, selected, false)
        remainingByGoal.set(goal.name, Math.max(0, remainingByGoal.get(goal.name) - 1))
        placedSession = true
      }
    })
  }

  orderedGoals.forEach((goal) => {
    const targetCount = goal.targetSessions > 0 ? goal.remaining : 1
    let assignedCount = assignments.filter((assignment) => assignment.goalName === goal.name).length
    while (assignedCount < targetCount) {
      const selected = chooseSlot(goal, true, true)
      if (!selected) {
        break
      }
      addAssignment(goal, selected, true)
      assignedCount += 1
    }
  })

  const goalsByName = new Map(goals.map((goal) => [goal.name, goal]))
  availableSlots.forEach((slot) => {
    const slotAssignments = assignments.filter((assignment) => assignment.slotId === slot.id)
    let remainingMinutes = Number(slot.minutes || 0) - slotAssignments.reduce((total, assignment) => total + assignment.totalTime, 0)

    slotAssignments.forEach((assignment) => {
      const goal = goalsByName.get(assignment.goalName)
      const maxDuration = Number(goal?.maxDuration ?? goal?.duration ?? assignment.duration)
      const extraDuration = Math.min(remainingMinutes, Math.max(0, maxDuration - assignment.duration))
      assignment.duration += extraDuration
      assignment.totalTime += extraDuration
      remainingMinutes -= extraDuration
    })
  })

  assignments.sort((first, second) => (
    getSlotOrder({ day: first.day, label: first.label }) - getSlotOrder({ day: second.day, label: second.label })
    || first.goalName.localeCompare(second.goalName)
  ))

  return assignments
}
