import { useEffect, useState } from 'react'
import './App.css'
import { buildRecommendation, defaultGoals, weightLiftingActivities } from './scheduler'
import { getGoalProgress } from './progress'
import { createHistoryCsv, createSettingsCsv } from './csvExport'
import { expandSavedGoal } from './goalMigration'
import { formatAvailableTime, formatTodayDate } from './displayFormat'
import {
  clampScaleValue,
  getMuscleUse,
  getSorenessValue,
  legacyMuscleUse,
  muscleAreas,
  normalizeMuscleUse,
} from './muscleModel'

const timeOptions = [
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
  { value: 120, label: '120 min' },
  { value: 180, label: '180 min' },
  { value: 480, label: 'All day' },
]
const energyOptions = [
  { value: 'cooked', label: '😴 Cooked' },
  { value: 'good', label: '⚡ Good' },
  { value: 'full-of-energy', label: '🔥 Full of energy' },
]
const travelOptions = [
  { value: 'no-travel', label: '🚫 No travel' },
  { value: 'prefer-home', label: '🏠 Prefer home' },
  { value: 'dont-mind', label: '🤷 Don’t mind' },
  { value: 'happy-to-travel', label: '🚗 Happy to travel' },
]
const likelihoodOptions = [
  { value: 'high', label: 'Likely' },
  { value: 'medium', label: 'Possible' },
  { value: 'low', label: 'Optional' },
]

function readNumberInput(value) {
  return value === '' ? '' : Number(value)
}

function clampSetupFrequency(value) {
  return Math.min(14, Math.max(1, Math.round(Number(value) || 1)))
}

function clampSetupPriority(value) {
  return Math.min(5, Math.max(1, Math.round(Number(value) || 3)))
}

function clampSetupTravelMinutes(value) {
  return Math.min(120, Math.max(0, Math.round(Number(value) || 0)))
}

function clampSetupGoalMinutes(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const minutes = Number(value)
  return Number.isFinite(minutes) ? Math.min(4000, Math.max(0, Math.round(minutes))) : null
}

function clampSetupDuration(value, fallback) {
  const numericValue = value === '' || value === null || value === undefined ? fallback : Number(value)
  return Math.min(240, Math.max(5, Math.round(Number.isFinite(numericValue) ? numericValue : fallback)))
}

function createCustomSetupGoal(name) {
  return {
    name,
    activity: name,
    priority: 3,
    targetFrequencyFortnight: 4,
    targetMinutesFortnight: null,
    travelMinutes: 15,
    muscleUse: Object.fromEntries(muscleAreas.map((area) => [area, 0.35])),
    minDuration: 30,
    maxDuration: 60,
  }
}

const setupSteps = [
  {
    title: 'Choose your activities',
    description: 'Pick the exercises you want in your plan. Each has its own starting calibration.',
  },
  {
    title: 'Choose session length',
    description: 'Set the shortest and longest session you want for each activity.',
  },
  {
    title: 'Set frequency and goal minutes',
    description: 'Choose sessions per two weeks and, if useful, an optional total-minutes target.',
  },
  {
    title: 'Set your priorities',
    description: 'Higher priority activities are scheduled first. Choose from 1 (lower) to 5 (higher).',
  },
  {
    title: 'Add travel time',
    description: 'Set the travel time the plan should allow for each activity session.',
  },
  {
    title: 'Adjust muscle impact',
    description: 'Each activity has pre-calibrated muscle values. Adjust any that do not fit your experience.',
  },
]

function dateForInput(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function dateFromInput(value) {
  if (!value) {
    return ''
  }

  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function sortHistory(sessions) {
  return [...sessions].sort((first, second) => (
    new Date(second.completedAt || second.time || 0).getTime()
    - new Date(first.completedAt || first.time || 0).getTime()
  ))
}

function downloadCsv(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function readSessionHistory() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem('personal-trainer-log')
    return raw ? sortHistory(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

function getRecentActivity(history) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return sortHistory(history).map((session) => ({
    activity: session.activity || session.title,
    daysAgo: Math.max(0, Math.floor((today.getTime() - new Date(session.completedAt || session.time).setHours(0, 0, 0, 0)) / 86400000)),
    duration: Number(session.duration) || 0,
  }))
}

const seededGoals = defaultGoals

const defaultSettings = {
  availableMinutes: 45,
  energy: 'good',
  travelPreference: 'prefer-home',
  activityPreferences: ['Anything'],
  musclePreferences: ['No preference'],
  recovery: {
    soreness: Object.fromEntries(muscleAreas.map((area) => [area, 0])),
  },
  availabilityDefaults: [],
  goals: seededGoals,
}

function readSavedSettings() {
  if (typeof window === 'undefined') {
    return defaultSettings
  }

  try {
    const raw = window.localStorage.getItem('personal-trainer-settings')
    if (!raw) {
      return defaultSettings
    }

    const saved = JSON.parse(raw)
    const savedSoreness = saved.recovery?.soreness || {}
    const soreness = Object.fromEntries(muscleAreas.map((area) => [
      area,
      getSorenessValue(savedSoreness[area] ?? savedSoreness.overall ?? 0),
    ]))
    const goals = Array.isArray(saved.goals)
      ? saved.goals.flatMap((goal) => expandSavedGoal(goal, seededGoals, weightLiftingActivities)).map((goal) => {
          const firstIntensity = Array.isArray(goal.intensities) ? goal.intensities[0] : null
          const {
            intensities: _intensities,
            minimumFrequency: _minimumFrequency,
            targetFrequency: legacyTargetFrequency,
            targetMinutes: legacyTargetMinutes,
            targetFrequencyFortnight: savedFortnightFrequency,
            targetMinutesFortnight: savedFortnightMinutes,
            muscles: legacyMuscles,
            muscleUse: savedMuscleUse,
            ...goalSettings
          } = goal
          const seededGoal = seededGoals.find((item) => item.name === goal.name)
          const muscleUse = normalizeMuscleUse(
            savedMuscleUse,
            seededGoal?.muscleUse || legacyMuscleUse(legacyMuscles),
          )
          const durationGoal = {
            minDuration: goal.minDuration ?? goal.duration ?? firstIntensity?.duration ?? 45,
            maxDuration: goal.maxDuration ?? goal.duration ?? firstIntensity?.duration ?? 45,
          }
          const oldWeeklySessions = legacyTargetFrequency == null
            ? null
            : Math.max(0, Number(legacyTargetFrequency) || 0)
          const migratedFortnightFrequency = Object.prototype.hasOwnProperty.call(goal, 'targetFrequencyFortnight')
            ? savedFortnightFrequency
            : oldWeeklySessions == null
              ? null
              : seededGoal?.name === 'Swimming' && oldWeeklySessions === 1
                ? 1
                : oldWeeklySessions * 2
          const previousAutoMinutes = Math.round(((Number(durationGoal.minDuration) + Number(durationGoal.maxDuration)) / 2) * (oldWeeklySessions || 0))
          const legacyMinutesWereGenerated = Object.prototype.hasOwnProperty.call(goal, 'targetMinutes')
            && goal.targetMinutes !== null
            && goal.targetMinutes !== ''
            && oldWeeklySessions !== null
            && Number(goal.targetMinutes) === previousAutoMinutes
          const savedFortnightMinutesWereGenerated = legacyMinutesWereGenerated
            && Number(savedFortnightMinutes) === previousAutoMinutes * 2
          const migratedFortnightMinutes = Object.prototype.hasOwnProperty.call(goal, 'targetMinutesFortnight')
            ? savedFortnightMinutesWereGenerated
              ? null
              : savedFortnightMinutes
            : Object.prototype.hasOwnProperty.call(goal, 'targetMinutes')
              ? legacyTargetMinutes === null || legacyTargetMinutes === ''
                ? null
                : legacyMinutesWereGenerated
                  ? null
                  : Math.max(0, Number(legacyTargetMinutes) || 0) * 2
              : null
          return {
            ...goalSettings,
            muscleUse,
            targetFrequencyFortnight: migratedFortnightFrequency,
            targetMinutesFortnight: migratedFortnightMinutes,
            minDuration: Number(goal.minDuration ?? goal.duration ?? firstIntensity?.duration ?? 45),
            maxDuration: Number(goal.maxDuration ?? goal.duration ?? firstIntensity?.duration ?? 45),
          }
        })
      : defaultSettings.goals

    return {
      ...defaultSettings,
      ...saved,
      energy: saved.energy === 'cooked' || saved.energy === 'full-of-energy'
        ? saved.energy
        : 'good',
      recovery: { ...defaultSettings.recovery, soreness },
      goals,
    }
  } catch {
    return defaultSettings
  }
}

function readSetupComplete() {
  if (typeof window === 'undefined') {
    return true
  }

  return window.localStorage.getItem('personal-trainer-setup-complete') === 'true'
}

function App() {
  const [settings, setSettings] = useState(readSavedSettings)
  const [history, setHistory] = useState(readSessionHistory)
  const [editingHistoryIndex, setEditingHistoryIndex] = useState(null)
  const [newHistoryEntry, setNewHistoryEntry] = useState(null)
  const [activeTab, setActiveTab] = useState('today')
  const [showSetup, setShowSetup] = useState(() => !readSetupComplete())
  const [setupStep, setSetupStep] = useState(0)
  const [customSetupGoals, setCustomSetupGoals] = useState([])
  const [customSetupName, setCustomSetupName] = useState('')
  const [setupExerciseSelections, setSetupExerciseSelections] = useState(() => Object.fromEntries(
    seededGoals.map((goal) => [goal.name, {
      selected: false,
      frequency: goal.targetFrequencyFortnight ?? 4,
      targetMinutesFortnight: goal.targetMinutesFortnight ?? '',
      priority: goal.priority ?? 3,
      travelMinutes: goal.travelMinutes ?? 0,
      minDuration: goal.minDuration ?? 30,
      maxDuration: goal.maxDuration ?? 60,
      muscleUse: normalizeMuscleUse(goal.muscleUse),
    }]),
  ))
  const [shareStatus, setShareStatus] = useState('')

  useEffect(() => {
    window.localStorage.setItem('personal-trainer-settings', JSON.stringify(settings))
  }, [settings])

  const recommendation = buildRecommendation({
    availableMinutes: settings.availableMinutes,
    energy: settings.energy,
    travelPreference: settings.travelPreference,
    activityPreferences: settings.activityPreferences.map((item) => item.toLowerCase()),
    musclePreferences: settings.musclePreferences.map((item) => item.toLowerCase()),
    goals: settings.goals,
    recentActivity: getRecentActivity(history),
    recovery: settings.recovery,
    plannedExercises: [],
  })
  const recommendationOptions = [recommendation, ...recommendation.alternatives]
  const [recommendationSelection, setRecommendationSelection] = useState({
    recommendationTitle: recommendation.title,
    selectedTitle: recommendation.title,
  })
  const selectedRecommendation = recommendationSelection.recommendationTitle === recommendation.title
    ? recommendationOptions.find((item) => item.title === recommendationSelection.selectedTitle) || recommendation
    : recommendation

  const weeklyProgress = getGoalProgress(settings.goals, history, { period: 'week' })
  const fortnightProgress = getGoalProgress(settings.goals, history, { period: 'fortnight' })

  const setupGoals = [...seededGoals, ...customSetupGoals]

  const completeSetup = () => {
    const selectedGoals = setupGoals
      .filter((goal) => setupExerciseSelections[goal.name]?.selected)
      .map((goal) => {
        const exercise = setupExerciseSelections[goal.name]
        const minDuration = clampSetupDuration(exercise.minDuration, goal.minDuration ?? 30)
        const maxDuration = Math.max(minDuration, clampSetupDuration(exercise.maxDuration, goal.maxDuration ?? 60))
        return {
          ...goal,
          targetFrequencyFortnight: clampSetupFrequency(exercise.frequency),
          targetMinutesFortnight: clampSetupGoalMinutes(exercise.targetMinutesFortnight),
          priority: clampSetupPriority(exercise.priority),
          travelMinutes: clampSetupTravelMinutes(exercise.travelMinutes),
          minDuration,
          maxDuration,
          muscleUse: normalizeMuscleUse(exercise.muscleUse, goal.muscleUse),
        }
      })

    const nextSettings = {
      ...settings,
      activityPreferences: selectedGoals.map((goal) => goal.activity || goal.name),
      goals: selectedGoals,
    }

    setSettings(nextSettings)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('personal-trainer-settings', JSON.stringify(nextSettings))
      window.localStorage.setItem('personal-trainer-setup-complete', 'true')
    }
    setActiveTab('today')
    setShowSetup(false)
  }

  const updateSetupExercise = (goal, updates) => {
    setSetupExerciseSelections((current) => ({
      ...current,
      [goal.name]: {
        selected: false,
        frequency: goal.targetFrequencyFortnight ?? 4,
        targetMinutesFortnight: goal.targetMinutesFortnight ?? '',
        priority: goal.priority ?? 3,
        travelMinutes: goal.travelMinutes ?? 0,
        minDuration: goal.minDuration ?? 30,
        maxDuration: goal.maxDuration ?? 60,
        muscleUse: normalizeMuscleUse(goal.muscleUse),
        ...current[goal.name],
        ...updates,
      },
    }))
  }

  const addCustomSetupGoal = () => {
    const name = customSetupName.trim()
    const duplicate = setupGoals.some((goal) => goal.name.toLowerCase() === name.toLowerCase())
    if (!name || duplicate) {
      return
    }

    const goal = createCustomSetupGoal(name)
    setCustomSetupGoals((current) => [...current, goal])
    setSetupExerciseSelections((current) => ({
      ...current,
      [name]: {
        selected: true,
        frequency: goal.targetFrequencyFortnight,
        targetMinutesFortnight: goal.targetMinutesFortnight ?? '',
        priority: goal.priority,
        travelMinutes: goal.travelMinutes,
        minDuration: goal.minDuration,
        maxDuration: goal.maxDuration,
        muscleUse: normalizeMuscleUse(goal.muscleUse),
      },
    }))
    setCustomSetupName('')
  }

  const commitSetupDuration = (goal, fieldName, value) => {
    const exercise = setupExerciseSelections[goal.name]
    let minDuration = clampSetupDuration(
      fieldName === 'minDuration' ? value : exercise.minDuration,
      goal.minDuration ?? 30,
    )
    let maxDuration = clampSetupDuration(
      fieldName === 'maxDuration' ? value : exercise.maxDuration,
      goal.maxDuration ?? 60,
    )

    if (fieldName === 'minDuration' && minDuration > maxDuration) {
      maxDuration = minDuration
    } else if (fieldName === 'maxDuration' && maxDuration < minDuration) {
      minDuration = maxDuration
    }

    updateSetupExercise(goal, { minDuration, maxDuration })
  }

  const selectedSetupGoals = setupGoals.filter((goal) => setupExerciseSelections[goal.name]?.selected)
  const setupIsReady = selectedSetupGoals.length > 0

  const updateSingleChoice = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const updateSoreness = (area, value) => {
    setSettings((current) => ({
      ...current,
      recovery: {
        ...current.recovery,
        soreness: { ...(current.recovery?.soreness || {}), [area]: clampScaleValue(value) },
      },
    }))
  }

  const updateGoal = (index, field, value) => {
    setSettings((current) => ({
      ...current,
      goals: current.goals.map((goal, goalIndex) => {
        if (goalIndex !== index) {
          return goal
        }

        return { ...goal, [field]: value }
      }),
    }))
  }

  const commitGoalNumber = (index, field, min, max, fallback) => {
    const rawValue = settings.goals[index]?.[field]
    const value = rawValue === '' || rawValue === null || rawValue === undefined
      ? fallback
      : Number(rawValue)
    updateGoal(index, field, Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback)))
  }

  const commitGoalDurationBounds = (index, editedField) => {
    const goal = settings.goals[index]
    let minDuration = Number(goal.minDuration ?? goal.duration ?? 45)
    let maxDuration = Number(goal.maxDuration ?? goal.duration ?? 45)
    minDuration = Math.min(240, Math.max(5, Number.isFinite(minDuration) ? minDuration : 45))
    maxDuration = Math.min(240, Math.max(5, Number.isFinite(maxDuration) ? maxDuration : 45))

    if (editedField === 'minDuration' && minDuration > maxDuration) {
      maxDuration = minDuration
    } else if (editedField === 'maxDuration' && maxDuration < minDuration) {
      minDuration = maxDuration
    }

    updateGoal(index, 'minDuration', minDuration)
    updateGoal(index, 'maxDuration', maxDuration)
  }

  const addGoal = () => {
    setSettings((current) => ({
      ...current,
      goals: [
        ...current.goals,
        {
          name: `Exercise ${current.goals.length + 1}`,
          activity: '',
          priority: 3,
          targetFrequencyFortnight: null,
          targetMinutesFortnight: null,
          travelMinutes: 15,
          muscleUse: normalizeMuscleUse({}),
          minDuration: 15,
          maxDuration: 60,
        },
      ],
    }))
  }

  const removeGoal = (index) => {
    setSettings((current) => ({
      ...current,
      goals: current.goals.filter((goal, goalIndex) => goalIndex !== index),
    }))
  }

  const updateAvailabilityDefault = (index, field, value) => {
    setSettings((current) => ({
      ...current,
      availabilityDefaults: current.availabilityDefaults.map((slot, slotIndex) => (
        slotIndex === index ? { ...slot, [field]: value } : slot
      )),
    }))
  }

  const addAvailabilityDefault = () => {
    setSettings((current) => ({
      ...current,
      availabilityDefaults: [
        ...current.availabilityDefaults,
        { day: 'Monday', label: 'New slot', minutes: 45, likelihood: 'medium' },
      ],
    }))
  }

  const removeAvailabilityDefault = (index) => {
    setSettings((current) => ({
      ...current,
      availabilityDefaults: current.availabilityDefaults.filter((_, slotIndex) => slotIndex !== index),
    }))
  }

  const updateCurrentWeeklyPlan = (updater) => {
    setWeeklyPlans((current) => {
      const existing = current[currentWeekKey] || {
        weekStart: currentWeekKey,
        slots: normalizeAvailabilitySlots(cloneAvailabilitySlots(settings.availabilityDefaults || defaultAvailabilitySlots)),
        assignments: [],
      }
      const nextPlan = updater({ ...existing, slots: mergeMissingDefaultSlots(existing.slots || []) })
      const next = { ...current, [currentWeekKey]: nextPlan }
      window.localStorage.setItem('personal-trainer-weekly-plans', JSON.stringify(next))
      return next
    })
  }

  const updateWeeklySlot = (index, field, value) => {
    updateCurrentWeeklyPlan((plan) => ({
      ...plan,
      slots: plan.slots.map((slot, slotIndex) => (
        slotIndex === index ? { ...slot, [field]: value } : slot
      )),
      assignments: [],
    }))
  }

  const addWeeklySlot = () => {
    updateCurrentWeeklyPlan((plan) => ({
      ...plan,
      slots: [...plan.slots, { day: 'Monday', label: 'New slot', minutes: 45, likelihood: 'medium' }],
      assignments: [],
    }))
  }

  const removeWeeklySlot = (index) => {
    updateCurrentWeeklyPlan((plan) => ({
      ...plan,
      slots: plan.slots.filter((_, slotIndex) => slotIndex !== index),
      assignments: [],
    }))
  }

  const restoreWeeklyDefaults = () => {
    updateCurrentWeeklyPlan((plan) => ({
      ...plan,
      slots: normalizeAvailabilitySlots(cloneAvailabilitySlots(settings.availabilityDefaults || defaultAvailabilitySlots)),
      assignments: [],
      generatedAt: null,
    }))
  }

  const updateWeeklyAssignment = (index, field, value) => {
    updateCurrentWeeklyPlan((plan) => ({
      ...plan,
      assignments: plan.assignments.map((assignment, assignmentIndex) => {
        if (assignmentIndex !== index) {
          return assignment
        }

        if (field === 'slotId') {
          const slot = plan.slots.find((item) => item.id === value)
          return slot
            ? { ...assignment, slotId: value, day: slot.day, label: slot.label }
            : assignment
        }

        if (field === 'goalName') {
          const goal = settings.goals.find((item) => item.name === value)
          return goal
            ? { ...assignment, goalName: goal.name, activity: goal.activity || goal.name }
            : assignment
        }

        const duration = readNumberInput(value)
        const goal = settings.goals.find((item) => item.name === assignment.goalName)
        return {
          ...assignment,
          duration,
          totalTime: Number(duration || 0) + Number(goal?.travelMinutes || 0),
        }
      }),
    }))
  }

  const removeWeeklyAssignment = (index) => {
    updateCurrentWeeklyPlan((plan) => ({
      ...plan,
      assignments: plan.assignments.filter((_, assignmentIndex) => assignmentIndex !== index),
    }))
  }

  const generateWeeklyPlan = () => {
    const planSlots = mergeMissingDefaultSlots(currentWeeklyPlan.slots)
    const assignments = buildWeeklyPlan({
      goals: settings.goals,
      progress: weeklyProgress,
      slots: planSlots,
      fromDayIndex: todayIndex,
    })
    const nextPlan = {
      ...currentWeeklyPlan,
      slots: planSlots,
      assignments,
      generatedAt: new Date().toISOString(),
    }
    setWeeklyPlans((current) => {
      const next = { ...current, [currentWeekKey]: nextPlan }
      window.localStorage.setItem('personal-trainer-weekly-plans', JSON.stringify(next))
      return next
    })
  }

  const persistHistory = (next) => {
    const ordered = sortHistory(next)
    setHistory(ordered)
    window.localStorage.setItem('personal-trainer-log', JSON.stringify(ordered))
  }

  const updateHistorySession = (index, field, value) => {
    const next = history.map((session, sessionIndex) => (
      sessionIndex === index
        ? { ...session, [field]: value, ...(field === 'activity' ? { title: value } : {}) }
        : session
    ))
    persistHistory(next)
  }

  const startHistoryEntry = () => {
    setEditingHistoryIndex(null)
    setNewHistoryEntry({
      activity: settings.goals[0]?.name || '',
      duration: 45,
      date: dateForInput(new Date()),
    })
  }

  const saveNewHistoryEntry = () => {
    const duration = Number(newHistoryEntry?.duration)
    const completedAt = dateFromInput(newHistoryEntry?.date)
    if (!newHistoryEntry?.activity || !completedAt || !Number.isFinite(duration) || duration <= 0) {
      return
    }

    persistHistory([
      {
        activity: newHistoryEntry.activity,
        title: newHistoryEntry.activity,
        duration,
        totalTime: duration,
        completedAt,
      },
      ...history,
    ])
    setNewHistoryEntry(null)
  }

  const deleteHistorySession = (index) => {
    persistHistory(history.filter((_, sessionIndex) => sessionIndex !== index))
    setEditingHistoryIndex(null)
  }

  const shareCsvFiles = async () => {
    setShareStatus('')
    const files = [
      new File([createHistoryCsv(history)], 'exercise-history.csv', { type: 'text/csv;charset=utf-8' }),
      new File([createSettingsCsv(settings)], 'exercise-settings.csv', { type: 'text/csv;charset=utf-8' }),
    ]

    if (navigator.share && navigator.canShare?.({ files })) {
      try {
        await navigator.share({
          title: 'Exercise history and settings',
          text: 'Exercise history and settings CSV files',
          files,
        })
        return
      } catch (error) {
        if (error.name === 'AbortError') {
          return
        }
      }
    }

    files.forEach((file) => downloadCsv(file.name, file))
    setShareStatus('CSV files downloaded. Attach them to an email to send.')
  }

  const addSessionLog = () => {
    const completedAt = new Date().toISOString()
    const next = [
      {
        activity: selectedRecommendation.title,
        title: selectedRecommendation.title,
        duration: selectedRecommendation.duration,
        totalTime: selectedRecommendation.totalTime,
        completedAt,
      },
      ...history,
    ]
    persistHistory(next)
    setActiveTab('history')
  }

  const cycleRecommendation = () => {
    const currentIndex = recommendationOptions.findIndex((item) => item.title === selectedRecommendation.title)
    const nextIndex = (currentIndex + 1) % recommendationOptions.length
    setRecommendationSelection({
      recommendationTitle: recommendation.title,
      selectedTitle: recommendationOptions[nextIndex].title,
    })
  }

  if (showSetup) {
    const currentSetupStep = setupSteps[setupStep]

    return (
      <div className="app-shell">
        <div className="card setup-card">
          <p className="eyebrow">Step {setupStep + 1} of {setupSteps.length}</p>
          <div className="setup-progress-bar" aria-hidden="true">
            <span style={{ width: `${((setupStep + 1) / setupSteps.length) * 100}%` }} />
          </div>
          <h1>{currentSetupStep.title}</h1>
          <p className="setup-copy">{currentSetupStep.description}</p>

          {setupStep === 0 ? (
            <>
              <form
                className="setup-custom-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  addCustomSetupGoal()
                }}
              >
                <input
                  type="text"
                  value={customSetupName}
                  aria-label="Custom exercise name"
                  placeholder="Add an exercise, e.g. Pickleball"
                  onChange={(event) => setCustomSetupName(event.target.value)}
                />
                <button
                  type="submit"
                  className="primary-button small"
                  disabled={!customSetupName.trim() || setupGoals.some((goal) => goal.name.toLowerCase() === customSetupName.trim().toLowerCase())}
                >
                  Add exercise
                </button>
              </form>
              <div className="setup-exercise-list">
                {setupGoals.map((goal) => {
                  const exercise = setupExerciseSelections[goal.name]
                  return (
                    <div className="setup-exercise-row" key={goal.name}>
                      <label className="setup-exercise-choice">
                        <input
                          type="checkbox"
                          checked={exercise.selected}
                          onChange={(event) => updateSetupExercise(goal, { selected: event.target.checked })}
                        />
                        <span>
                          <strong>{goal.name}</strong>
                          <small>{goal.minDuration}-{goal.maxDuration} min</small>
                        </span>
                      </label>
                    </div>
                  )
                })}
              </div>
            </>
          ) : setupStep === 1 ? (
            <div className="setup-exercise-list">
              {selectedSetupGoals.map((goal) => {
                const exercise = setupExerciseSelections[goal.name]
                return (
                  <div className="setup-exercise-row setup-duration-row" key={goal.name}>
                    <div className="setup-exercise-summary">
                      <strong>{goal.name}</strong>
                    </div>
                    <div className="setup-field-pair">
                      {[
                        { name: 'minDuration', label: 'Min (min)' },
                        { name: 'maxDuration', label: 'Max (min)' },
                      ].map((field) => (
                        <label className="setup-frequency-field" key={field.name}>
                          <span>{field.label}</span>
                          <input
                            type="number"
                            min="5"
                            max="240"
                            step="5"
                            value={exercise[field.name]}
                            aria-label={`${goal.name} ${field.name === 'minDuration' ? 'minimum' : 'maximum'} session minutes`}
                            onChange={(event) => updateSetupExercise(goal, { [field.name]: event.target.value })}
                            onBlur={(event) => commitSetupDuration(goal, field.name, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : setupStep === 2 ? (
            <div className="setup-exercise-list">
              {selectedSetupGoals.map((goal) => {
                const exercise = setupExerciseSelections[goal.name]
                return (
                  <div className="setup-exercise-row" key={goal.name}>
                    <div className="setup-exercise-summary">
                      <strong>{goal.name}</strong>
                    </div>
                    <div className="setup-field-pair">
                      <label className="setup-frequency-field">
                        <span>Sessions / 2wk</span>
                        <input
                          type="number"
                          min="1"
                          max="14"
                          step="1"
                          value={exercise.frequency}
                          aria-label={`${goal.name} sessions per 2 weeks`}
                          onChange={(event) => updateSetupExercise(goal, { frequency: event.target.value })}
                          onBlur={(event) => updateSetupExercise(goal, { frequency: clampSetupFrequency(event.target.value) })}
                        />
                      </label>
                      <label className="setup-frequency-field">
                        <span>Goal min / 2wk</span>
                        <input
                          type="number"
                          min="0"
                          max="4000"
                          step="1"
                          value={exercise.targetMinutesFortnight ?? ''}
                          aria-label={`${goal.name} optional goal minutes per fortnight`}
                          onChange={(event) => updateSetupExercise(goal, { targetMinutesFortnight: event.target.value })}
                          onBlur={(event) => updateSetupExercise(goal, { targetMinutesFortnight: clampSetupGoalMinutes(event.target.value) })}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : setupStep === 3 ? (
            <div className="setup-exercise-list">
              {selectedSetupGoals.map((goal) => {
                const exercise = setupExerciseSelections[goal.name]
                return (
                  <div className="setup-exercise-row" key={goal.name}>
                    <div className="setup-exercise-summary">
                      <strong>{goal.name}</strong>
                    </div>
                    <label className="setup-frequency-field">
                      <span>Priority (1-5)</span>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        step="1"
                        value={exercise.priority}
                        aria-label={`${goal.name} priority from 1 to 5`}
                        onChange={(event) => updateSetupExercise(goal, { priority: event.target.value })}
                        onBlur={(event) => updateSetupExercise(goal, { priority: clampSetupPriority(event.target.value) })}
                      />
                    </label>
                  </div>
                )
              })}
            </div>
          ) : setupStep === 4 ? (
            <div className="setup-exercise-list">
              {selectedSetupGoals.map((goal) => {
                const exercise = setupExerciseSelections[goal.name]
                return (
                  <div className="setup-exercise-row" key={goal.name}>
                    <div className="setup-exercise-summary">
                      <strong>{goal.name}</strong>
                    </div>
                    <label className="setup-frequency-field">
                      <span>Travel (min)</span>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        step="5"
                        value={exercise.travelMinutes}
                        aria-label={`${goal.name} travel minutes per session`}
                        onChange={(event) => updateSetupExercise(goal, { travelMinutes: event.target.value })}
                        onBlur={(event) => updateSetupExercise(goal, { travelMinutes: clampSetupTravelMinutes(event.target.value) })}
                      />
                    </label>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="setup-exercise-list setup-muscle-list">
              {selectedSetupGoals.map((goal) => {
                const exercise = setupExerciseSelections[goal.name]
                const muscleUse = normalizeMuscleUse(exercise.muscleUse, goal.muscleUse)
                return (
                  <div className="setup-muscle-item" key={goal.name}>
                    <details className="setup-muscle-details">
                      <summary>{goal.name}</summary>
                      <p className="field-help">0 = no meaningful load; 1 = heavy load.</p>
                      <div className="muscle-load-list">
                        {muscleAreas.map((area) => {
                          const value = getMuscleUse(muscleUse, area)
                          return (
                            <label className="muscle-load-row" key={`${goal.name}-${area}`} style={{ '--scale-hue': `${260 + 70 * value}`, '--scale-progress': `${value * 100}%` }}>
                              <span>{area}</span>
                              <input
                                type="range"
                                className="scale-slider scale-slider--muscle-use"
                                min="0"
                                max="1"
                                step="0.01"
                                value={value}
                                aria-label={`${goal.name} ${area} muscle impact`}
                                aria-valuetext={`${Math.round(value * 100)}% impact`}
                                onChange={(event) => updateSetupExercise(goal, {
                                  muscleUse: { ...muscleUse, [area]: clampScaleValue(event.target.value) },
                                })}
                              />
                              <output>{value.toFixed(2)}</output>
                            </label>
                          )
                        })}
                      </div>
                    </details>
                  </div>
                )
              })}
            </div>
          )}

          <div className="setup-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSetupStep((current) => Math.max(0, current - 1))}
              disabled={setupStep === 0}
            >
              Back
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setupStep === setupSteps.length - 1 ? completeSetup() : setSetupStep((current) => current + 1)}
              disabled={setupStep === 0 && !setupIsReady}
            >
              {setupStep === setupSteps.length - 1 ? 'Start planning' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{formatTodayDate()}</p>
          <h1>
            You have <span>{formatAvailableTime(settings.availableMinutes)}</span> available
          </h1>
        </div>
        <button type="button" className="primary-button">
          What should I do?
        </button>
      </header>

      <nav className="tab-bar" aria-label="Main navigation">
        <button
          type="button"
          className={activeTab === 'today' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={activeTab === 'history' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button
          type="button"
          className={activeTab === 'progress' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('progress')}
        >
          Progress
        </button>
        <button
          type="button"
          className={activeTab === 'settings' ? 'tab active settings-tab' : 'tab settings-tab'}
          onClick={() => setActiveTab('settings')}
          aria-label="Settings"
          title="Settings"
        >
          ⚙
        </button>
      </nav>

      {activeTab === 'today' ? (
        <main className="planner">
          <section className="card">
            <h2>How much time do you have?</h2>
            <div className="pill-grid">
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={settings.availableMinutes === option.value ? 'pill selected' : 'pill'}
                  onClick={() => updateSingleChoice('availableMinutes', option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="inline-field">
              <span>Custom</span>
              <input
                type="number"
                min="15"
                max="480"
                value={settings.availableMinutes}
                onChange={(event) => updateSingleChoice('availableMinutes', readNumberInput(event.target.value))}
              />
            </label>
          </section>

          <section className="card">
            <h2>How are you feeling?</h2>
            <div className="pill-grid slim">
              {energyOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={settings.energy === option.value ? 'pill selected' : 'pill'}
                  onClick={() => updateSingleChoice('energy', option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>How sore is each area?</h2>
            <div className="soreness-scale-labels" aria-hidden="true">
              <span>0 · Not sore</span>
              <span>1 · Extremely sore</span>
            </div>
            <div className="soreness-list">
              {muscleAreas.map((area) => {
                const value = getSorenessValue(settings.recovery?.soreness?.[area])
                return (
                  <div key={area} className="soreness-row">
                    <strong>{area}</strong>
                    <label className="scale-control" style={{ '--scale-hue': `${260 + 70 * value}`, '--scale-progress': `${value * 100}%` }}>
                      <input
                        type="range"
                        className="scale-slider scale-slider--soreness"
                        min="0"
                        max="1"
                        step="0.01"
                        value={value}
                        aria-label={`${area} soreness`}
                        aria-valuetext={`${Math.round(value * 100)}% sore`}
                        onChange={(event) => updateSoreness(area, event.target.value)}
                      />
                      <output>{value.toFixed(2)}</output>
                    </label>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="card">
            <h2>How do you feel about travelling?</h2>
            <div className="pill-grid slim">
              {travelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={settings.travelPreference === option.value ? 'pill selected' : 'pill'}
                  onClick={() => updateSingleChoice('travelPreference', option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="card recommendation-card">
            <p className="eyebrow">Option {recommendationOptions.findIndex((item) => item.title === selectedRecommendation.title) + 1} of {recommendationOptions.length}</p>
            <h2 className="recommendation-title">{selectedRecommendation.title}</h2>
            <div className="meta-row">
              <span>{selectedRecommendation.duration} min</span>
              <span>{selectedRecommendation.totalTime} min including travel</span>
            </div>
            <p className="reason">{selectedRecommendation.reason}</p>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={addSessionLog}>
                Mark as complete
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={cycleRecommendation}
                disabled={recommendationOptions.length < 2}
              >
                Next option
              </button>
            </div>
          </section>

          <section className="card">
            <h2>Other options</h2>
            <div className="options-list">
              {recommendation.alternatives.map((item) => (
                <div key={item.title} className="option-item">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.totalTime} min total</span>
                  </div>
                  <small>{item.reason}</small>
                </div>
              ))}
            </div>
          </section>

        </main>
      ) : activeTab === 'plan' ? (
        <main className="planner weekly-plan-tab">
          <section className="card">
            <p className="eyebrow">Week of {currentWeekKey}</p>
            <div className="card-header-row">
              <div>
                <h2>Weekly plan</h2>
                <p className="field-help">Set the time you might have, then build a rough plan around your goals.</p>
                <p className="field-help">{currentWeeklyPlan.slots.length} availability windows, {currentWeeklyPlan.assignments.length} generated sessions.</p>
              </div>
              <div className="weekly-plan-actions">
                <button type="button" className="secondary-button small" onClick={restoreWeeklyDefaults}>
                  Restore defaults
                </button>
                <button type="button" className="primary-button small" onClick={generateWeeklyPlan}>
                  {currentWeeklyPlan.generatedAt ? 'Replan' : 'Build plan'}
                </button>
              </div>
            </div>
            <div className="availability-list">
              {currentWeeklyPlan.slots.map((slot, index) => (
                <div className="availability-row" key={slot.id || `${slot.day}-${slot.label}-${index}`}>
                  <select value={slot.day} onChange={(event) => updateWeeklySlot(index, 'day', event.target.value)}>
                    {dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                  <input type="text" value={slot.label} onChange={(event) => updateWeeklySlot(index, 'label', event.target.value)} />
                  <input type="number" min="0" max="480" value={slot.minutes} onChange={(event) => updateWeeklySlot(index, 'minutes', readNumberInput(event.target.value))} />
                  <select value={slot.likelihood} onChange={(event) => updateWeeklySlot(index, 'likelihood', event.target.value)}>
                    {likelihoodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <button type="button" className="remove-button" onClick={() => removeWeeklySlot(index)}>Remove</button>
                </div>
              ))}
            </div>
            <button type="button" className="secondary-button small" onClick={addWeeklySlot}>+ Add availability</button>
          </section>

          <section className="card">
            <h2>Rough plan</h2>
            {currentWeeklyPlan.assignments.length ? (
              <div className="weekly-assignment-list">
                {currentWeeklyPlan.assignments.map((assignment) => (
                  <div className={assignment.optional ? 'weekly-assignment optional' : 'weekly-assignment'} key={assignment.id}>
                    <div>
                      <select value={assignment.slotId} onChange={(event) => updateWeeklyAssignment(currentWeeklyPlan.assignments.indexOf(assignment), 'slotId', event.target.value)}>
                        {currentWeeklyPlan.slots.map((slot) => (
                          <option key={slot.id} value={slot.id}>{slot.day} {slot.label}</option>
                        ))}
                      </select>
                      <select value={assignment.goalName} onChange={(event) => updateWeeklyAssignment(currentWeeklyPlan.assignments.indexOf(assignment), 'goalName', event.target.value)}>
                        {settings.goals.map((goal) => <option key={goal.name} value={goal.name}>{goal.name}</option>)}
                      </select>
                      <input type="number" min="5" max="240" value={assignment.duration} onChange={(event) => updateWeeklyAssignment(currentWeeklyPlan.assignments.indexOf(assignment), 'duration', event.target.value)} />
                      <button type="button" className="remove-button" onClick={() => removeWeeklyAssignment(currentWeeklyPlan.assignments.indexOf(assignment))}>Remove</button>
                    </div>
                    <span>{assignment.totalTime} min total including travel</span>
                    <p>{assignment.optional ? 'Optional slot. ' : ''}{assignment.rationale}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-history">No plan yet. Edit your availability and choose Build plan.</p>
            )}
            {currentWeeklyPlan.generatedAt ? (
              <p className="field-help">Generated {currentWeeklyPlan.assignments.length} sessions. Replan uses your latest progress and availability.</p>
            ) : null}
          </section>
        </main>
      ) : activeTab === 'settings' ? (
        <main className="planner settings-tab-page">
          <details className="card settings-section" open>
            <summary>Exercise settings</summary>
            <div className="settings-section-body">
            <p className="field-help settings-intro">Set fortnight goals and the details used for recommendations. Priority affects what is suggested; body areas drive soreness checks; travel/setup counts against available time. A blank activity match uses the exercise name.</p>
            <div className="card-header-row">
              <button type="button" className="primary-button small" onClick={addGoal}>
                + Add exercise
              </button>
            </div>

            {settings.goals.map((goal, index) => (
              <div key={index} className="goal-editor">
                <h3 className="goal-editor-title">{goal.name || `Exercise ${index + 1}`}</h3>
                <div className="editor-grid">
                  <label>
                    <span>Exercise name</span>
                    <input
                      type="text"
                      value={goal.name}
                      onChange={(event) => updateGoal(index, 'name', event.target.value)}
                    />
                  </label>

                  <label>
                    <span>Activity match (optional)</span>
                    <input
                      type="text"
                      value={goal.activity ?? ''}
                      placeholder={goal.name}
                      onChange={(event) => updateGoal(index, 'activity', event.target.value)}
                    />
                  </label>

                  <label>
                    <span>Recommendation priority (1-5)</span>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="1"
                      value={goal.priority ?? ''}
                      onChange={(event) => updateGoal(index, 'priority', readNumberInput(event.target.value))}
                      onBlur={() => commitGoalNumber(index, 'priority', 1, 5, 3)}
                    />
                  </label>

                  <label>
                    <span>Sessions per fortnight</span>
                    <input
                      type="number"
                      min="0"
                      max="14"
                      step="1"
                      value={goal.targetFrequencyFortnight ?? ''}
                      onChange={(event) => updateGoal(index, 'targetFrequencyFortnight', event.target.value === '' ? null : readNumberInput(event.target.value))}
                      onBlur={() => {
                        if (goal.targetFrequencyFortnight !== null && goal.targetFrequencyFortnight !== undefined) {
                          commitGoalNumber(index, 'targetFrequencyFortnight', 0, 14, 0)
                        }
                      }}
                    />
                  </label>

                  <label>
                    <span>Minutes per fortnight (optional)</span>
                    <input
                      type="number"
                      min="0"
                      max="4000"
                      value={goal.targetMinutesFortnight ?? ''}
                      onChange={(event) => updateGoal(index, 'targetMinutesFortnight', event.target.value === '' ? null : readNumberInput(event.target.value))}
                      onBlur={() => {
                        if (goal.targetMinutesFortnight !== null && goal.targetMinutesFortnight !== undefined) {
                          commitGoalNumber(index, 'targetMinutesFortnight', 0, 4000, 0)
                        }
                      }}
                    />
                  </label>

                  <label>
                    <span>Shortest session (minutes)</span>
                    <input
                      type="number"
                      min="5"
                      max="240"
                      value={goal.minDuration ?? goal.duration ?? 45}
                      onChange={(event) => updateGoal(index, 'minDuration', readNumberInput(event.target.value))}
                      onBlur={() => commitGoalDurationBounds(index, 'minDuration')}
                    />
                  </label>

                  <label>
                    <span>Longest session (minutes)</span>
                    <input
                      type="number"
                      min="5"
                      max="240"
                      value={goal.maxDuration ?? goal.duration ?? 45}
                      onChange={(event) => updateGoal(index, 'maxDuration', readNumberInput(event.target.value))}
                      onBlur={() => commitGoalDurationBounds(index, 'maxDuration')}
                    />
                  </label>

                  <label>
                    <span>Travel / setup (min)</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={goal.travelMinutes ?? 0}
                      onChange={(event) => updateGoal(index, 'travelMinutes', readNumberInput(event.target.value))}
                      onBlur={() => commitGoalNumber(index, 'travelMinutes', 0, 120, 0)}
                    />
                  </label>
                </div>

                <div className="muscle-editor">
                  <span>Muscle use (0–1)</span>
                  <p className="field-help">0 = none; 1 = heavy use</p>
                  <div className="muscle-load-list">
                    {muscleAreas.map((area) => {
                      const value = getMuscleUse(goal.muscleUse, area)
                      return (
                        <label className="muscle-load-row" key={`${goal.name}-${area}`} style={{ '--scale-hue': `${260 + 70 * value}`, '--scale-progress': `${value * 100}%` }}>
                          <span>{area}</span>
                          <input
                            type="range"
                            className="scale-slider scale-slider--muscle-use"
                            min="0"
                            max="1"
                            step="0.01"
                            value={value}
                            aria-label={`${goal.name} ${area} use`}
                            aria-valuetext={`${value.toFixed(2)} muscle use`}
                            onChange={(event) => updateGoal(index, 'muscleUse', {
                              ...normalizeMuscleUse(goal.muscleUse),
                              [area]: clampScaleValue(event.target.value),
                            })}
                          />
                          <output>{value.toFixed(2)}</output>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <button type="button" className="remove-button" onClick={() => removeGoal(index)}>
                  Remove exercise
                </button>
              </div>
            ))}
            </div>
          </details>

          <details className="card settings-section" open>
            <summary>Send to email</summary>
            <div className="settings-section-body">
              <button type="button" className="primary-button small" onClick={shareCsvFiles}>
                Share CSV files
              </button>
              {shareStatus ? <p className="field-help" role="status">{shareStatus}</p> : null}
            </div>
          </details>

          <details className="card debug-card settings-section" open>
            <summary>Ranking debug</summary>
            <div className="settings-section-body">
            <div className="debug-list">
              {recommendation.debug && recommendation.debug.length ? recommendation.debug.map((item) => (
                <div key={`${item.title}-${item.score}`} className="debug-item">
                  <div className="debug-header">
                    <strong>{item.title}</strong>
                    <span className={item.valid ? 'debug-score valid' : 'debug-score invalid'}>
                      {item.score}
                    </span>
                  </div>

                  <div className="debug-calculation">
                    <span>Calculation</span>
                    <code>{item.calculation}</code>
                  </div>

                  <div className="debug-metrics">
                    {Object.entries(item.breakdown || {}).map(([label, value]) => (
                      <div key={`${item.title}-${label}`} className="debug-metric">
                        <span>{label}</span>
                        <strong>{Number(value) > 0 ? '+' : ''}{Number(value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )) : <p className="empty-debug">No debug data available yet.</p>}
            </div>
            </div>
          </details>
        </main>
      ) : activeTab === 'progress' ? (
        <main className="planner progress-tab">
          <section className="card">
            <p className="eyebrow">Last 14 days</p>
            <h2>Fortnightly progress</h2>
            <div className="progress-list">
              {fortnightProgress.map((goal) => {
                const hasSessionTarget = Number(goal.targetSessions) > 0
                const sessionPercent = hasSessionTarget
                  ? Math.min(100, (goal.sessions / goal.targetSessions) * 100)
                  : 0
                const minutePercent = goal.targetMinutes !== null && goal.targetMinutes !== undefined && goal.targetMinutes > 0
                  ? Math.min(100, (goal.completedMinutes / goal.targetMinutes) * 100)
                  : 0

                return (
                  <div key={goal.name} className="progress-item">
                    {hasSessionTarget ? (
                      <>
                        <div className="progress-heading">
                          <strong>{goal.name}</strong>
                          <span>{goal.sessions} / {goal.targetSessions} sessions</span>
                        </div>
                        <div className="progress-track" aria-label={`${goal.name} sessions progress`}>
                          <span style={{ width: `${sessionPercent}%` }} />
                        </div>
                      </>
                    ) : (
                      <div className="progress-heading">
                        <strong>{goal.name}</strong>
                        <span>Time goal</span>
                      </div>
                    )}
                    {goal.targetMinutes !== null && goal.targetMinutes !== undefined && goal.targetMinutes > 0 ? (
                      <>
                        <div className="progress-heading progress-minutes-heading">
                          <span>Minutes</span>
                          <span>{goal.completedMinutes} / {goal.targetMinutes} min</span>
                        </div>
                        <div className="progress-track minutes" aria-label={`${goal.name} minutes progress`}>
                          <span style={{ width: `${minutePercent}%` }} />
                        </div>
                      </>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </main>
      ) : (
        <main className="planner history-tab">
          <section className="card">
            <div className="card-header-row history-header">
              <div>
                <p className="eyebrow">Completed sessions</p>
                <h2>Exercise history</h2>
              </div>
              <button
                type="button"
                className="primary-button small"
                onClick={startHistoryEntry}
                disabled={!settings.goals.length}
              >
                + Add session
              </button>
            </div>
            {newHistoryEntry ? (
              <div className="history-item history-item-new">
                <div className="history-editor">
                  <label>
                    <span>Exercise</span>
                    <select
                      value={newHistoryEntry.activity}
                      onChange={(event) => setNewHistoryEntry((current) => ({ ...current, activity: event.target.value }))}
                    >
                      {settings.goals.map((goal, index) => (
                        <option key={`${goal.name}-${index}`} value={goal.name}>{goal.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Duration</span>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={newHistoryEntry.duration}
                      onChange={(event) => setNewHistoryEntry((current) => ({ ...current, duration: readNumberInput(event.target.value) }))}
                    />
                  </label>
                  <label>
                    <span>Date</span>
                    <input
                      type="date"
                      value={newHistoryEntry.date}
                      onChange={(event) => setNewHistoryEntry((current) => ({ ...current, date: event.target.value }))}
                    />
                  </label>
                  <div className="history-actions">
                    <button
                      type="button"
                      className="primary-button small"
                      onClick={saveNewHistoryEntry}
                      disabled={!newHistoryEntry.activity || !newHistoryEntry.date || !Number.isFinite(Number(newHistoryEntry.duration)) || Number(newHistoryEntry.duration) <= 0}
                    >
                      Save session
                    </button>
                    <button type="button" className="secondary-button small" onClick={() => setNewHistoryEntry(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {history.length ? (
              <div className="history-list">
                {history.map((session, index) => (
                  <div key={`${session.completedAt || session.time}-${index}`} className="history-item">
                    {editingHistoryIndex === index ? (
                      <div className="history-editor">
                        <label>
                          <span>Exercise</span>
                          <select
                            value={session.activity || session.title || ''}
                            onChange={(event) => updateHistorySession(index, 'activity', event.target.value)}
                          >
                            {(session.activity || session.title) && !settings.goals.some((goal) => goal.name === (session.activity || session.title)) ? (
                              <option value={session.activity || session.title}>{session.activity || session.title} (not in settings)</option>
                            ) : null}
                            {settings.goals.map((goal, goalIndex) => (
                              <option key={`${goal.name}-${goalIndex}`} value={goal.name}>{goal.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Duration</span>
                          <input
                            type="number"
                            min="0"
                            max="480"
                            value={session.duration ?? ''}
                            onChange={(event) => updateHistorySession(index, 'duration', readNumberInput(event.target.value))}
                          />
                        </label>
                        <label>
                          <span>Date</span>
                          <input
                            type="date"
                            value={dateForInput(session.completedAt || session.time || '')}
                            onChange={(event) => updateHistorySession(index, 'completedAt', dateFromInput(event.target.value))}
                          />
                        </label>
                        <div className="history-actions">
                          <button type="button" className="secondary-button small" onClick={() => setEditingHistoryIndex(null)}>
                            Done
                          </button>
                          <button type="button" className="remove-button" onClick={() => deleteHistorySession(index)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <strong>{session.activity || session.title}</strong>
                          <span>{session.duration} min exercise</span>
                        </div>
                        <time dateTime={session.completedAt || session.time}>
                          {new Date(session.completedAt || session.time).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </time>
                        <button type="button" className="secondary-button small" onClick={() => setEditingHistoryIndex(index)}>
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-history">No completed exercises yet. Mark a recommendation as complete and it will appear here.</p>
            )}
          </section>
        </main>
      )}
    </div>
  )
}

export default App
