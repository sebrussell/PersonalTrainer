import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { buildRecommendation } from './scheduler'

const timeOptions = [20, 30, 45, 60, 90, 120]
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

const seededGoals = [
  {
    name: 'Climbing',
    activity: 'Climbing',
    priority: 5,
    targetFrequency: 2,
    minimumFrequency: 1,
    travelMinutes: 45,
    muscles: ['Back', 'Shoulders', 'Grip', 'Core'],
    intensities: [
      { label: 'Easy climb', duration: 60, commitment: 90 },
      { label: 'Session climb', duration: 90, commitment: 150 },
      { label: 'Project session', duration: 120, commitment: 200 },
    ],
  },
  {
    name: 'Swimming',
    activity: 'Swimming',
    priority: 3,
    targetFrequency: 1,
    minimumFrequency: 1,
    travelMinutes: 25,
    muscles: ['Shoulders', 'Core', 'Legs'],
    intensities: [
      { label: 'Easy swim', duration: 35, commitment: 60 },
      { label: 'Tempo swim', duration: 45, commitment: 80 },
      { label: 'Long swim', duration: 60, commitment: 100 },
    ],
  },
  {
    name: 'Running',
    activity: 'Running',
    priority: 4,
    targetFrequency: 3,
    minimumFrequency: 1,
    travelMinutes: 15,
    muscles: ['Legs', 'Core'],
    intensities: [
      { label: 'Easy run', duration: 35, commitment: 45 },
      { label: 'Long run', duration: 60, commitment: 90 },
      { label: 'Tempo run', duration: 45, commitment: 70 },
    ],
  },
  {
    name: 'Walking',
    activity: 'Walking',
    priority: 2,
    targetFrequency: 4,
    minimumFrequency: 2,
    travelMinutes: 5,
    muscles: ['Legs', 'Core'],
    intensities: [
      { label: 'Walk', duration: 30, commitment: 30 },
      { label: 'Brisk walk', duration: 45, commitment: 55 },
      { label: 'Long walk', duration: 60, commitment: 75 },
    ],
  },
  {
    name: 'Cycling',
    activity: 'Cycling',
    priority: 2,
    targetFrequency: 1,
    minimumFrequency: 1,
    travelMinutes: 20,
    muscles: ['Legs', 'Core'],
    intensities: [
      { label: 'Easy ride', duration: 40, commitment: 55 },
      { label: 'Endurance ride', duration: 60, commitment: 90 },
      { label: 'Hill ride', duration: 50, commitment: 80 },
    ],
  },
  {
    name: 'Weight training',
    activity: 'Weight training',
    priority: 4,
    targetFrequency: 2,
    minimumFrequency: 1,
    travelMinutes: 15,
    muscles: ['Chest', 'Back', 'Shoulders', 'Legs'],
    intensities: [
      { label: 'Strength session', duration: 45, commitment: 60 },
      { label: 'Hypertrophy session', duration: 60, commitment: 90 },
      { label: 'Power session', duration: 50, commitment: 75 },
    ],
  },
  {
    name: 'Yoga',
    activity: 'Yoga',
    priority: 2,
    targetFrequency: 2,
    minimumFrequency: 1,
    travelMinutes: 10,
    muscles: ['Core', 'Back', 'Legs'],
    intensities: [
      { label: 'Mobility flow', duration: 25, commitment: 30 },
      { label: 'Recovery yoga', duration: 35, commitment: 40 },
      { label: 'Power yoga', duration: 45, commitment: 55 },
    ],
  },
]

const defaultSettings = {
  availableMinutes: 45,
  energy: 'normal',
  travelPreference: 'prefer-home',
  activityPreferences: ['Anything'],
  musclePreferences: ['No preference'],
  goals: seededGoals,
}

function readSavedSettings() {
  if (typeof window === 'undefined') {
    return defaultSettings
  }

  try {
    const raw = window.localStorage.getItem('personal-trainer-settings')
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

function App() {
  const [settings, setSettings] = useState(readSavedSettings)
  const [activeTab, setActiveTab] = useState('today')

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
        recentActivity: [
          { activity: 'Running', daysAgo: 4 },
          { activity: 'Climbing', daysAgo: 2 },
          { activity: 'Strength', daysAgo: 3 },
        ],
        recovery: settings.recovery,
      }),
    [settings],
  )

  const cycleOption = (value, list, key) => {
    setSettings((current) => {
      const next = current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value]

      if (key === 'activityPreferences' && value === 'Anything') {
        return { ...current, [key]: ['Anything'] }
      }

      if (key === 'activityPreferences' && next.includes('Anything')) {
        return { ...current, [key]: ['Anything'] }
      }

      if (key === 'activityPreferences' && next.length === 0) {
        return { ...current, [key]: ['Anything'] }
      }

      return { ...current, [key]: next }
    })
  }

  const updateSingleChoice = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }))
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
          intensities: [
            { label: 'Easy session', duration: 30, commitment: 45 },
            { label: 'Main session', duration: 50, commitment: 70 },
          ],
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

  const addSessionLog = () => {
    const existing = JSON.parse(window.localStorage.getItem('personal-trainer-log') || '[]')
    const next = [
      { title: recommendation.title, duration: recommendation.duration, commitment: recommendation.commitment, time: new Date().toISOString() },
      ...existing,
    ]
    window.localStorage.setItem('personal-trainer-log', JSON.stringify(next.slice(0, 5)))
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Thursday 24 September</p>
          <h1>
            You have <span>{settings.availableMinutes} min</span> available
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
      </nav>

      {activeTab === 'today' ? (
        <main className="planner">
          <section className="card">
            <h2>How much time do you have?</h2>
            <div className="pill-grid">
              {timeOptions.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={settings.availableMinutes === minutes ? 'pill selected' : 'pill'}
                  onClick={() => updateSingleChoice('availableMinutes', minutes)}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <label className="inline-field">
              <span>Custom</span>
              <input
                type="number"
                min="15"
                max="240"
                value={settings.availableMinutes}
                onChange={(event) => updateSingleChoice('availableMinutes', Number(event.target.value) || 45)}
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
              <span>Total commitment: {recommendation.commitment} min</span>
            </div>
            <p className="reason">{recommendation.reason}</p>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={addSessionLog}>
                Start Session
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
                    <span>{item.duration} min</span>
                  </div>
                  <small>{item.reason}</small>
                </div>
              ))}
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
      ) : (
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
                      onChange={(event) => updateGoal(index, 'priority', Number(event.target.value) || 1)}
                    />
                  </label>

                  <label>
                    <span>Target / week</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      value={goal.targetFrequency}
                      onChange={(event) => updateGoal(index, 'targetFrequency', Number(event.target.value) || 0)}
                    />
                  </label>

                  <label>
                    <span>Minimum / week</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      value={goal.minimumFrequency ?? 1}
                      onChange={(event) => updateGoal(index, 'minimumFrequency', Number(event.target.value) || 0)}
                    />
                  </label>

                  <label>
                    <span>Travel time</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={goal.travelMinutes ?? 0}
                      onChange={(event) => updateGoal(index, 'travelMinutes', Number(event.target.value) || 0)}
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

                <div className="muscle-editor">
                  <span>Intensity options</span>
                  <div className="pill-grid slim">
                    {(goal.intensities || []).map((variant) => (
                      <span key={`${goal.name}-${variant.label}`} className="variant-pill">
                        {variant.label}
                      </span>
                    ))}
                  </div>
                </div>

                <button type="button" className="remove-button" onClick={() => removeGoal(index)}>
                  Remove type
                </button>
              </div>
            ))}
          </section>
        </main>
      )}
    </div>
  )
}

export default App
