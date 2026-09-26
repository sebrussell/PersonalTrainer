export function estimateLegacyTargetMinutes(goal, sessions) {
  const minDuration = Number(goal.minDuration ?? goal.duration ?? 45)
  const maxDuration = Number(goal.maxDuration ?? goal.duration ?? minDuration)
  return Math.round(((minDuration + maxDuration) / 2) * sessions)
}

export function expandSavedGoal(goal, defaultGoals, weightLiftingActivities) {
  if (String(goal.name || '').trim().toLowerCase() !== 'weight training') {
    return [goal]
  }

  const liftingGoals = defaultGoals.filter((item) => weightLiftingActivities.includes(item.name))
  const legacyWeeklySessions = goal.targetFrequency == null
    ? null
    : Math.max(0, Number(goal.targetFrequency) || 0)
  const totalSessionTarget = Object.prototype.hasOwnProperty.call(goal, 'targetFrequencyFortnight')
    ? goal.targetFrequencyFortnight == null || goal.targetFrequencyFortnight === ''
      ? null
      : Math.max(0, Number(goal.targetFrequencyFortnight) || 0)
    : legacyWeeklySessions == null
      ? null
      : legacyWeeklySessions === 2 ? 6 : legacyWeeklySessions * 2
  const sessionBase = totalSessionTarget == null ? 0 : Math.floor(totalSessionTarget / liftingGoals.length)
  const extraSessions = totalSessionTarget == null ? 0 : Math.round(totalSessionTarget - sessionBase * liftingGoals.length)
  const legacyMinutes = Object.prototype.hasOwnProperty.call(goal, 'targetMinutesFortnight')
    ? goal.targetMinutesFortnight == null || goal.targetMinutesFortnight === ''
      ? null
      : Math.max(0, Number(goal.targetMinutesFortnight) || 0)
    : Object.prototype.hasOwnProperty.call(goal, 'targetMinutes')
      ? goal.targetMinutes == null || goal.targetMinutes === ''
        ? null
        : Number(goal.targetMinutes) === estimateLegacyTargetMinutes(goal, legacyWeeklySessions || 0) && legacyWeeklySessions !== null
          ? null
          : Math.max(0, Number(goal.targetMinutes) || 0) * 2
      : null
  const sessionMinutes = legacyMinutes == null ? null : legacyMinutes / liftingGoals.length
  const {
    intensities: _intensities,
    minimumFrequency: _minimumFrequency,
    targetFrequency: _targetFrequency,
    targetMinutes: _targetMinutes,
    targetFrequencyFortnight: _targetFrequencyFortnight,
    targetMinutesFortnight: _targetMinutesFortnight,
    muscles: _muscles,
    muscleUse: _muscleUse,
    name: _name,
    activity: _activity,
    ...sharedSettings
  } = goal

  return liftingGoals.map((liftingGoal, index) => ({
    ...liftingGoal,
    ...sharedSettings,
    name: liftingGoal.name,
    activity: liftingGoal.activity,
    priority: goal.priority ?? liftingGoal.priority,
    travelMinutes: goal.travelMinutes ?? liftingGoal.travelMinutes,
    muscleUse: liftingGoal.muscleUse,
    targetFrequencyFortnight: totalSessionTarget == null
      ? null
      : sessionBase + (index < extraSessions ? 1 : 0),
    targetMinutesFortnight: sessionMinutes,
    minDuration: Number(goal.minDuration ?? goal.duration ?? 45),
    maxDuration: Number(goal.maxDuration ?? goal.duration ?? 45),
  }))
}