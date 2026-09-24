import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { buildRecommendation } from './scheduler'

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
  { value: 'normal', label: '😐 Normal' },
  { value: 'good', label: '⚡ Good' },
  { value: 'full-of-energy', label: '🔥 Full of energy' },
]
const travelOptions = [
  { value: 'no-travel', label: '🚫 No travel' },
  { value: 'prefer-home', label: '🏠 Prefer home' },
  { value: 'dont-mind', label: '🤷 Don’t mind' },
  { value: 'happy-to-travel', label: '🚗 Happy to travel' },
]
const activityOptions = ['Running', 'Walking', 'Cycling', 'Climbing', 'Swimming', 'Weight training', 'Yoga', 'Anything']
const muscleOptions = ['Chest', 'Back', 'Shoulders', 'Legs', 'Core', 'Grip', 'Full body', 'No preference']
const sorenessOptions = [
  { value: 'not-sore', label: 'Not sore' },
  { value: 'a-little-sore', label: 'A little sore' },
  { value: 'sore', label: 'Sore' },
]
const sorenessAreas = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Grip']

function readNumberInput(value) {
  return value === '' ? '' : Number(value)
}

function sortHistory(sessions) {
  return [...sessions].sort((first, second) => (
    new Date(second.completedAt || second.time || 0).getTime()
    - new Date(first.completedAt || first.time || 0).getTime()
  ))
}

function formatAvailableTime(minutes) {
  return Number(minutes) >= 480 ? 'all day' : `${minutes} min`
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
  const now = Date.now()

  return sortHistory(history).map((session) => ({
    activity: session.activity || session.title,
    daysAgo: Math.max(0, Math.floor((now - new Date(session.completedAt || session.time).getTime()) / 86400000)),
  }))
}

function getTargetMinutes(goal, targetSessions) {
  if (Object.prototype.hasOwnProperty.call(goal, 'targetMinutes')) {
    if (goal.targetMinutes === null || goal.targetMinutes === '') {
      return null
    }

    return Math.max(0, Number(goal.targetMinutes) || 0)
  }

  const minDuration = Number(goal.minDuration ?? goal.duration ?? 45)
  const maxDuration = Number(goal.maxDuration ?? goal.duration ?? minDuration)
  return Math.round(((minDuration + maxDuration) / 2) * targetSessions)
}

function getWeeklyProgress(goals, history) {
  const now = new Date()
  const weekStart = new Date(now)
  const day = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1))
  weekStart.setHours(0, 0, 0, 0)

  return goals.map((goal) => {
    const goalKeys = [goal.name, goal.activity]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
    const sessions = history.filter((session) => {
      const completedAt = new Date(session.completedAt || session.time || 0)
      const activity = String(session.activity || session.title || '').toLowerCase()
      return completedAt >= weekStart && goalKeys.some((key) => activity === key)
    })
    const targetSessions = Math.max(0, Number(goal.targetFrequency) || 0)
    const targetMinutes = getTargetMinutes(goal, targetSessions)
    const completedMinutes = sessions.reduce((total, session) => total + (Number(session.duration) || 0), 0)

    return {
      name: goal.name,
      sessions: sessions.length,
      targetSessions,
      completedMinutes,
      targetMinutes,
    }
  })
}

const seededGoals = [
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
].map((goal) => ({
  ...goal,
  targetMinutes: getTargetMinutes(goal, Math.max(0, Number(goal.targetFrequency) || 0)),
}))

const defaultSettings = {
  availableMinutes: 45,
  energy: 'normal',
  travelPreference: 'prefer-home',
  activityPreferences: ['Anything'],
  musclePreferences: ['No preference'],
  recovery: {
    soreness: Object.fromEntries(sorenessAreas.map((area) => [area, 'not-sore'])),
  },
  goals: seededGoals,
}

const setupModeOptions = [
  { value: 'default', label: 'Use the default exercise list' },
  { value: 'custom', label: 'Choose / edit my exercise list manually' },
]

const setupQuestions = [
  {
    type: 'multi',
    title: 'Which exercise types do you actually enjoy?',
    description: 'Choose the activities you want to see in your plan most often.',
    key: 'activityPreferences',
    options: activityOptions.filter((option) => option !== 'Anything'),
  },
  {
    type: 'single',
    title: 'When you have 60 minutes and feel good, what sounds best?',
    description: 'This helps calibrate how ambitious your recommended sessions should be.',
    key: 'goodDayFeeling',
    options: [
      { value: 'performance', label: 'A proper hard session' },
      { value: 'balanced', label: 'A steady, balanced workout' },
      { value: 'easy', label: 'Something low-effort and low-friction' },
    ],
  },
  {
    type: 'single',
    title: 'When your energy is low, what do you prefer?',
    description: 'This helps the app choose recovery-friendly recommendations.',
    key: 'lowEnergyPreference',
    options: [
      { value: 'easy-movement', label: 'Easy movement or a walk' },
      { value: 'short-strength', label: 'A short strength session' },
      { value: 'rest', label: 'I would rather rest' },
    ],
  },
  {
    type: 'single',
    title: 'How much travel do you usually tolerate?',
    key: 'travelPreference',
    options: travelOptions.map((option) => ({ value: option.value, label: option.label })),
  },
]

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
    const soreness = Object.fromEntries(sorenessAreas.map((area) => [
      area,
      savedSoreness[area] || savedSoreness.overall || 'not-sore',
    ]))
    const goals = Array.isArray(saved.goals)
      ? saved.goals.map((goal) => {
          const firstIntensity = Array.isArray(goal.intensities) ? goal.intensities[0] : null
          const { intensities, ...goalWithoutIntensities } = goal
          return {
            ...goalWithoutIntensities,
            minDuration: Number(goal.minDuration ?? goal.duration ?? firstIntensity?.duration ?? 45),
            maxDuration: Number(goal.maxDuration ?? goal.duration ?? firstIntensity?.duration ?? 45),
            targetMinutes: Object.prototype.hasOwnProperty.call(goal, 'targetMinutes')
              ? goal.targetMinutes
              : getTargetMinutes(goalWithoutIntensities, Math.max(0, Number(goal.targetFrequency) || 0)),
          }
        })
      : defaultSettings.goals

    return { ...defaultSettings, ...saved, recovery: { ...defaultSettings.recovery, soreness }, goals }
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

function createCustomGoal(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) {
    return null
  }

  return {
    name: trimmed,
    activity: trimmed,
    priority: 3,
    targetFrequency: 1,
    minimumFrequency: 1,
    travelMinutes: 15,
    muscles: ['Full body'],
    minDuration: 15,
    maxDuration: 120,
  }
}

function App() {
  const [settings, setSettings] = useState(readSavedSettings)
  const [history, setHistory] = useState(readSessionHistory)
  const [editingHistoryIndex, setEditingHistoryIndex] = useState(null)
  const [activeTab, setActiveTab] = useState('today')
  const [showSetup, setShowSetup] = useState(() => !readSetupComplete())
  const [setupStep, setSetupStep] = useState(0)
  const [setupAnswers, setSetupAnswers] = useState({})
  const [customExerciseInput, setCustomExerciseInput] = useState('')

  useEffect(() => {
    window.localStorage.setItem('personal-trainer-settings', JSON.stringify(settings))
  }, [settings])

  const recommendation = useMemo(
    () =>
      buildRecommendation({
        availableMinutes: settings.availableMinutes,
        energy: settings.energy,
        travelPreference: settings.travelPreference,
        activityPreferences: settings.activityPreferences.map((item) => item.toLowerCase()),
        musclePreferences: settings.musclePreferences.map((item) => item.toLowerCase()),
        goals: settings.goals,
        recentActivity: getRecentActivity(history),
        recovery: settings.recovery,
      }),
    [history, settings],
  )
  const weeklyProgress = getWeeklyProgress(settings.goals, history)

  const toggleSetupSelection = (key, value) => {
    setSetupAnswers((current) => {
      const existing = Array.isArray(current[key]) ? current[key] : []
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value]

      return { ...current, [key]: next }
    })
  }

  const completeSetup = () => {
    const selectedExercises = setupAnswers.customExercises?.length
      ? setupAnswers.customExercises
      : setupAnswers.activityPreferences?.length
        ? setupAnswers.activityPreferences
        : ['Walking', 'Running']

    const selectedGoalNames = new Set(selectedExercises.map((item) => String(item).trim()))
    const customGoals = selectedExercises
      .map((item) => createCustomGoal(item))
      .filter(Boolean)
      .filter((goal) => !seededGoals.some((defaultGoal) => defaultGoal.name.toLowerCase() === goal.name.toLowerCase()))

    const nextSettings = {
      ...settings,
      activityPreferences: selectedExercises,
      travelPreference: setupAnswers.travelPreference ?? settings.travelPreference,
      energy: setupAnswers.lowEnergyPreference === 'rest'
        ? 'cooked'
        : setupAnswers.goodDayFeeling === 'easy'
          ? 'normal'
          : 'good',
      goals: [
        ...seededGoals.filter((goal) => selectedGoalNames.has(goal.name) || selectedGoalNames.has(goal.activity)),
        ...customGoals,
      ],
    }

    setSettings(nextSettings)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('personal-trainer-settings', JSON.stringify(nextSettings))
      window.localStorage.setItem('personal-trainer-setup-complete', 'true')
    }
    setShowSetup(false)
  }

  const setupFlow = setupAnswers.setupMode === 'custom'
    ? [{
        type: 'multi',
        title: 'Start with the exercises you want in your plan',
        description: 'You can edit these later from the Exercise types tab.',
        key: 'customExercises',
        options: seededGoals.map((goal) => goal.name),
      }, ...setupQuestions]
    : setupQuestions

  const currentSetupQuestion = setupFlow[setupStep]
  const setupIsReady = currentSetupQuestion.type === 'multi'
    ? (setupAnswers[currentSetupQuestion.key] || []).length > 0
    : Boolean(setupAnswers[currentSetupQuestion.key])

  const cycleOption = (value, list, key) => {
    setSettings((current) => {
      if (key === 'activityPreferences') {
        if (value === 'Anything') {
          return {
            ...current,
            [key]: current[key].includes(value) ? [] : ['Anything'],
          }
        }

        return {
          ...current,
          [key]: withoutAnything.includes(value)
            ? withoutAnything.filter((item) => item !== value)
            : [...withoutAnything, value],
        }
      }

      const next = current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value]
      return { ...current, [key]: next }
    })
  }

  const updateSingleChoice = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const updateSoreness = (area, value) => {
    setSettings((current) => ({
      ...current,
      recovery: {
        ...current.recovery,
        soreness: { ...(current.recovery?.soreness || {}), [area]: value },
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

        if (field === 'muscles') {
          return { ...goal, muscles: value }
        }

        return { ...goal, [field]: value }
      }),
    }))
  }

  const addGoal = () => {
    setSettings((current) => ({
      ...current,
      goals: [
        ...current.goals,
        {
          name: `Exercise ${current.goals.length + 1}`,
          activity: 'Running',
          priority: 3,
          targetFrequency: 2,
          minimumFrequency: 1,
          travelMinutes: 15,
          muscles: ['Legs'],
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

  const persistHistory = (next) => {
    const ordered = sortHistory(next)
    setHistory(ordered)
    window.localStorage.setItem('personal-trainer-log', JSON.stringify(ordered))
  }

  const updateHistorySession = (index, field, value) => {
    const next = history.map((session, sessionIndex) => (
      sessionIndex === index ? { ...session, [field]: value } : session
    ))
    persistHistory(next)
  }

  const deleteHistorySession = (index) => {
    persistHistory(history.filter((_, sessionIndex) => sessionIndex !== index))
    setEditingHistoryIndex(null)
  }

  const addSessionLog = () => {
    const completedAt = new Date().toISOString()
    const next = [
      {
        activity: recommendation.title,
        title: recommendation.title,
        duration: recommendation.duration,
        totalTime: recommendation.totalTime,
        completedAt,
      },
      ...history,
    ]
    persistHistory(next)
    setActiveTab('history')
  }

  if (showSetup) {
    return (
      <div className="app-shell">
        <div className="card setup-card">
          <p className="eyebrow">Starter setup</p>
          <h1>Tell us how you like to move</h1>
          <p className="setup-copy">This quick calibration will help us choose better sessions for your energy and schedule.</p>

          {setupAnswers.setupMode ? (
            <div className="setup-progress">
              <span>{setupStep + 1} / {setupFlow.length}</span>
              <div className="setup-progress-bar">
                <span style={{ width: `${((setupStep + 1) / setupFlow.length) * 100}%` }} />
              </div>
            </div>
          ) : null}

          {setupAnswers.setupMode ? (
            <>
              <h2>{currentSetupQuestion.title}</h2>
              {currentSetupQuestion.description ? <p className="setup-copy">{currentSetupQuestion.description}</p> : null}
            </>
          ) : (
            <>
              <h2>How do you want to start?</h2>
              <p className="setup-copy">Pick a default exercise list or build your own before we calibrate your recommendations.</p>
            </>
          )}

          {!setupAnswers.setupMode ? (
            <div className="pill-grid slim setup-grid">
              {setupModeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={setupAnswers.setupMode === option.value ? 'pill selected' : 'pill'}
                  onClick={() => {
                    const nextMode = option.value
                    const seedExercises = seededGoals.map((goal) => goal.name)
                    setSetupAnswers((current) => ({
                      ...current,
                      setupMode: nextMode,
                      customExercises: nextMode === 'default' ? seedExercises : current.customExercises || seedExercises,
                    }))
                    setSetupStep(0)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : currentSetupQuestion.key === 'customExercises' ? (
            <div className="custom-exercise-step">
              <div className="custom-exercise-input-row">
                <input
                  type="text"
                  placeholder="Add exercise, e.g. Archery"
                  value={customExerciseInput}
                  onChange={(event) => setCustomExerciseInput(event.target.value)}
                />
                <button
                  type="button"
                  className="primary-button small"
                  onClick={() => {
                    const value = customExerciseInput.trim()
                    if (!value) {
                      return
                    }

                    setSetupAnswers((current) => {
                      const existing = Array.isArray(current.customExercises) ? current.customExercises : []
                      if (existing.some((item) => item.toLowerCase() === value.toLowerCase())) {
                        return current
                      }

                      return {
                        ...current,
                        customExercises: [...existing, value],
                      }
                    })
                    setCustomExerciseInput('')
                  }}
                >
                  Add
                </button>
              </div>

              <div className="pill-grid slim setup-grid">
                {(setupAnswers.customExercises || []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={(setupAnswers.customExercises || []).includes(option) ? 'pill selected' : 'pill'}
                    onClick={() => {
                      setSetupAnswers((current) => ({
                        ...current,
                        customExercises: (current.customExercises || []).includes(option)
                          ? (current.customExercises || []).filter((item) => item !== option)
                          : [...(current.customExercises || []), option],
                      }))
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : currentSetupQuestion.type === 'multi' ? (
            <div className="pill-grid slim setup-grid">
              {currentSetupQuestion.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={(setupAnswers[currentSetupQuestion.key] || []).includes(option) ? 'pill selected' : 'pill'}
                  onClick={() => toggleSetupSelection(currentSetupQuestion.key, option)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="pill-grid slim setup-grid">
              {currentSetupQuestion.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={setupAnswers[currentSetupQuestion.key] === option.value ? 'pill selected' : 'pill'}
                  onClick={() => setSetupAnswers((current) => ({ ...current, [currentSetupQuestion.key]: option.value }))}
                >
                  {option.label}
                </button>
              ))}
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
              onClick={() => {
                if (setupStep === setupFlow.length - 1) {
                  completeSetup()
                  return
                }

                setSetupStep((current) => current + 1)
              }}
              disabled={!setupIsReady}
            >
              {setupStep === setupFlow.length - 1 ? 'Finish setup' : 'Next'}
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
          <p className="eyebrow">Thursday 24 September</p>
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
          className={activeTab === 'goals' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('goals')}
        >
          Exercise types
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
            <div className="soreness-list">
              {sorenessAreas.map((area) => (
                <div key={area} className="soreness-row">
                  <strong>{area}</strong>
                  <div className="pill-grid slim">
                    {sorenessOptions.map((option) => (
                      <button
                        key={`${area}-${option.value}`}
                        type="button"
                        className={settings.recovery?.soreness?.[area] === option.value ? 'pill selected' : 'pill'}
                        onClick={() => updateSoreness(area, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="field-help">A little soreness keeps related sessions in the shorter half of their length range. Sore blocks them.</p>
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

          <section className="card">
            <h2>What do you fancy?</h2>
            <div className="pill-grid slim">
              {activityOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={settings.activityPreferences.includes(option) ? 'pill selected' : 'pill'}
                  onClick={() => cycleOption(option, settings.activityPreferences, 'activityPreferences')}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Anything you’d particularly like to train today?</h2>
            <div className="pill-grid slim">
              {muscleOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={settings.musclePreferences.includes(option) ? 'pill selected' : 'pill'}
                  onClick={() => cycleOption(option, settings.musclePreferences, 'musclePreferences')}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          <section className="card recommendation-card">
            <p className="eyebrow">Your best option</p>
            <h2 className="recommendation-title">{recommendation.title}</h2>
            <div className="meta-row">
              <span>{recommendation.duration} min</span>
              <span>{recommendation.totalTime} min including travel</span>
            </div>
            <p className="reason">{recommendation.reason}</p>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={addSessionLog}>
                Mark as complete
              </button>
              <button type="button" className="secondary-button">
                Save for later
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

          <section className="card debug-card">
            <h2>Ranking debug</h2>
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
          </section>

          <section className="card">
            <h2>Weekly plan</h2>
            <div className="week-grid">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                <div key={day} className="day-block">
                  <span>{day}</span>
                  <strong>{index % 2 === 0 ? 'Strength' : index === 1 ? 'Easy run' : index === 3 ? 'Climbing' : 'Walk'}</strong>
                </div>
              ))}
            </div>
          </section>
        </main>
      ) : activeTab === 'goals' ? (
        <main className="planner goals-tab">
          <section className="card">
            <div className="card-header-row">
              <h2>Exercise types</h2>
              <button type="button" className="primary-button small" onClick={addGoal}>
                + Add type
              </button>
            </div>

            {settings.goals.map((goal, index) => (
              <div key={`${goal.name}-${index}`} className="goal-editor">
                <div className="editor-grid">
                  <label>
                    <span>Name</span>
                    <input
                      type="text"
                      value={goal.name}
                      onChange={(event) => updateGoal(index, 'name', event.target.value)}
                    />
                  </label>

                  <label>
                    <span>Activity</span>
                    <select
                      value={goal.activity || goal.name}
                      onChange={(event) => updateGoal(index, 'activity', event.target.value)}
                    >
                      {activityOptions.filter((option) => option !== 'Anything').map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Priority</span>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={goal.priority}
                      onChange={(event) => updateGoal(index, 'priority', readNumberInput(event.target.value))}
                    />
                  </label>

                  <label>
                    <span>Target / week</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      value={goal.targetFrequency}
                      onChange={(event) => updateGoal(index, 'targetFrequency', readNumberInput(event.target.value))}
                    />
                  </label>

                  <label>
                    <span>Minimum / week</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      value={goal.minimumFrequency ?? 1}
                      onChange={(event) => updateGoal(index, 'minimumFrequency', readNumberInput(event.target.value))}
                    />
                  </label>

                  <label>
                    <span>Minimum length</span>
                    <input
                      type="number"
                      min="5"
                      max="240"
                      value={goal.minDuration ?? goal.duration ?? 45}
                      onChange={(event) => updateGoal(index, 'minDuration', readNumberInput(event.target.value))}
                    />
                  </label>

                  <label>
                    <span>Maximum length</span>
                    <input
                      type="number"
                      min="5"
                      max="240"
                      value={goal.maxDuration ?? goal.duration ?? 45}
                      onChange={(event) => updateGoal(index, 'maxDuration', readNumberInput(event.target.value))}
                    />
                  </label>

                  <label>
                    <span>Minutes target (clear for sessions only)</span>
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      placeholder={String(getTargetMinutes(goal, Math.max(0, Number(goal.targetFrequency) || 0)) ?? '')}
                      value={goal.targetMinutes ?? ''}
                      onChange={(event) => updateGoal(index, 'targetMinutes', event.target.value === '' ? null : readNumberInput(event.target.value))}
                    />
                  </label>

                  <label>
                    <span>Travel time</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={goal.travelMinutes ?? 0}
                      onChange={(event) => updateGoal(index, 'travelMinutes', readNumberInput(event.target.value))}
                    />
                  </label>
                </div>

                <div className="muscle-editor">
                  <span>Muscles used</span>
                  <div className="pill-grid slim">
                    {muscleOptions.filter((option) => option !== 'No preference').map((option) => {
                      const selected = Array.isArray(goal.muscles) && goal.muscles.includes(option)
                      return (
                        <button
                          key={`${goal.name}-${option}`}
                          type="button"
                          className={selected ? 'pill selected' : 'pill'}
                          onClick={() => {
                            const current = Array.isArray(goal.muscles) ? [...goal.muscles] : []
                            const next = current.includes(option)
                              ? current.filter((item) => item !== option)
                              : [...current, option]
                            updateGoal(index, 'muscles', next)
                          }}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button type="button" className="remove-button" onClick={() => removeGoal(index)}>
                  Remove type
                </button>
              </div>
            ))}
          </section>
        </main>
      ) : activeTab === 'progress' ? (
        <main className="planner progress-tab">
          <section className="card">
            <p className="eyebrow">This week</p>
            <h2>Weekly progress</h2>
            <div className="progress-list">
              {weeklyProgress.map((goal) => {
                const sessionPercent = goal.targetSessions
                  ? Math.min(100, (goal.sessions / goal.targetSessions) * 100)
                  : 0
                const minutePercent = goal.targetMinutes
                  ? Math.min(100, (goal.completedMinutes / goal.targetMinutes) * 100)
                  : 0

                return (
                  <div key={goal.name} className="progress-item">
                    <div className="progress-heading">
                      <strong>{goal.name}</strong>
                      <span>{goal.sessions} / {goal.targetSessions} sessions</span>
                    </div>
                    <div className="progress-track" aria-label={`${goal.name} sessions progress`}>
                      <span style={{ width: `${sessionPercent}%` }} />
                    </div>
                    {goal.targetMinutes !== null ? (
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
            <p className="eyebrow">Completed sessions</p>
            <h2>Exercise history</h2>
            {history.length ? (
              <div className="history-list">
                {history.map((session, index) => (
                  <div key={`${session.completedAt || session.time}-${index}`} className="history-item">
                    {editingHistoryIndex === index ? (
                      <div className="history-editor">
                        <label>
                          <span>Exercise</span>
                          <input
                            type="text"
                            value={session.activity || session.title || ''}
                            onChange={(event) => updateHistorySession(index, 'activity', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Duration</span>
                          <input
                            type="number"
                            min="0"
                            max="240"
                            value={session.duration ?? ''}
                            onChange={(event) => updateHistorySession(index, 'duration', readNumberInput(event.target.value))}
                          />
                        </label>
                        <label>
                          <span>Date</span>
                          <input
                            type="date"
                            value={String(session.completedAt || session.time || '').slice(0, 10)}
                            onChange={(event) => updateHistorySession(index, 'completedAt', new Date(`${event.target.value}T12:00:00`).toISOString())}
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
