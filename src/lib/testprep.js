import { todayStr } from './streak'

// Days from today until dateStr (0 = today, 1 = tomorrow). Never negative.
export function daysUntil(dateStr, today = todayStr()) {
  const target = new Date(dateStr + 'T00:00:00Z')
  const now = new Date(today + 'T00:00:00Z')
  return Math.max(0, Math.round((target - now) / 86400000))
}

export function countdownLabel(subjectName, testDate, today = todayStr()) {
  const days = daysUntil(testDate, today)
  if (days === 0) return `${subjectName} test today`
  if (days === 1) return `${subjectName} test tomorrow`
  return `${subjectName} test in ${days} days`
}

// progress lives inside plan_data as { "d<day>q<index>": { selectedIndex, correct } },
// recording first attempts only — retries are never persisted or rewarded.
export function progressKey(day, questionIndex) {
  return `d${day}q${questionIndex}`
}

export function countPlanQuestions(planData) {
  return (planData.days || []).reduce((sum, day) => sum + (day.questions?.length || 0), 0)
}

export function countCorrectFirstAttempts(planData) {
  const progress = planData.progress || {}
  return Object.values(progress).filter((p) => p.correct).length
}

// Readiness = percentage of the plan's questions answered correctly (first attempt).
export function computeReadiness(planData) {
  const total = countPlanQuestions(planData)
  if (total === 0) return 0
  return Math.round((countCorrectFirstAttempts(planData) / total) * 100)
}

export function isDayComplete(planData, day) {
  const progress = planData.progress || {}
  return (day.questions || []).every((_, i) => progress[progressKey(day.day, i)])
}

// Day 1 unlocks the day the plan is created; each later day unlocks one
// calendar day after the previous. If the test is today or tomorrow
// (daysAvailable <= 1), everything is open at once.
export function isDayUnlocked(plan, day, today = todayStr()) {
  if (plan.days_available <= 1) return true
  const createdDate = plan.created_at.slice(0, 10)
  const start = new Date(createdDate + 'T00:00:00Z')
  const now = new Date(today + 'T00:00:00Z')
  const daysSinceCreated = Math.round((now - start) / 86400000)
  return day.day - 1 <= daysSinceCreated
}
