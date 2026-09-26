function getWindowStart(period, now) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (period === 'fortnight') {
    start.setDate(start.getDate() - 13)
    return start
  }

  const day = start.getDay()
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
  return start
}

export function getGoalProgress(goals, history, { period = 'week', now = new Date() } = {}) {
  const isFortnight = period === 'fortnight'
  const windowStart = getWindowStart(period, now)

  return goals.map((goal) => {
    const goalKeys = [goal.name, goal.activity]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
    const sessions = history.filter((session) => {
      const completedAt = new Date(session.completedAt || session.time || 0)
      const activity = String(session.activity || session.title || '').trim().toLowerCase()
      return completedAt >= windowStart
        && completedAt <= now
        && goalKeys.some((key) => activity === key)
    })
    const fortnightSessions = Math.max(0, Number(goal.targetFrequencyFortnight) || 0)
    const fortnightMinutes = Object.prototype.hasOwnProperty.call(goal, 'targetMinutesFortnight')
      && goal.targetMinutesFortnight !== null
      && goal.targetMinutesFortnight !== ''
      ? Math.max(0, Number(goal.targetMinutesFortnight) || 0)
      : null
    const targetSessions = isFortnight ? fortnightSessions : fortnightSessions / 2
    const targetMinutes = isFortnight || fortnightMinutes === null
      ? fortnightMinutes
      : fortnightMinutes / 2
    const completedMinutes = sessions.reduce((total, session) => total + (Number(session.duration) || 0), 0)

    return {
      name: goal.name,
      priority: Number(goal.priority) || 0,
      sessions: sessions.length,
      targetSessions,
      completedMinutes,
      targetMinutes,
    }
  }).sort((first, second) => second.priority - first.priority)
}