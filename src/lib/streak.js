// XP and coins earn at the same rate: 1 per correct answer, plus a one-time
// bonus (added to both) the day a streak milestone is hit.
export const XP_PER_CORRECT = 1
export const COINS_PER_CORRECT = 1
// Parents can override these per-family (see users.milestone_settings); this
// is the fallback for students with no linked parent or no custom settings.
export const DEFAULT_MILESTONE_BONUSES = { 7: 10, 14: 20, 30: 50 }

export function todayStr(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function diffDays(laterStr, earlierStr) {
  const later = new Date(laterStr + 'T00:00:00Z')
  const earlier = new Date(earlierStr + 'T00:00:00Z')
  return Math.round((later - earlier) / 86400000)
}

// A day only counts toward the streak once all 6 subjects have been
// answered correctly on the first attempt that day.
export const TOTAL_SUBJECTS = 6

// 6 subjects × 7 days of first-attempt-correct answers, Monday through Sunday.
export const PERFECT_WEEK_TARGET = 42

// The Monday (inclusive) that starts the ISO week containing dateStr.
export function mondayOfWeek(dateStr = todayStr()) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

// history only ever contains first attempts (retries are never persisted —
// see submitAnswer), so this is just "correct answers since Monday."
export function getWeeklyCorrectCount(history, today = todayStr()) {
  const weekStart = mondayOfWeek(today)
  return history.filter((entry) => entry.correct && entry.date >= weekStart && entry.date <= today).length
}

export function hasAnsweredSubjectToday(progress, subjectId, today = todayStr()) {
  return progress.history.some((h) => h.date === today && h.subjectId === subjectId)
}

// Distinct subjects answered correctly (first attempt) on the given day.
export function countCorrectSubjectsToday(history, today = todayStr()) {
  const subjectIds = new Set()
  for (const entry of history) {
    if (entry.date === today && entry.correct) subjectIds.add(entry.subjectId)
  }
  return subjectIds.size
}

// The streak as it should be displayed *before* today's question is answered.
// A gap of more than one day since the streak was last credited means a full
// day (all 6 subjects correct) was missed, so the streak is already broken
// even if the user hasn't opened the app to "confirm" it.
export function getEffectiveStreak(progress, today = todayStr()) {
  if (!progress.lastCorrectDate) return 0
  const gap = diffDays(today, progress.lastCorrectDate)
  return gap <= 1 ? progress.streak : 0
}

export function applyDailyAnswer(
  progress,
  question,
  selectedIndex,
  subjectId,
  today = todayStr(),
  milestoneBonuses = DEFAULT_MILESTONE_BONUSES
) {
  const correct = selectedIndex === question.correctIndex
  const effStreak = getEffectiveStreak(progress, today)

  // Coins/XP are awarded per correct answer regardless of how many subjects
  // are done today — only the day-streak itself is gated on completing all 6.
  const baseEarned = correct ? XP_PER_CORRECT : 0

  const entry = {
    date: today,
    subjectId,
    questionId: question.id,
    prompt: question.prompt,
    options: question.options,
    selectedIndex,
    correctIndex: question.correctIndex,
    selectedAnswer: question.options[selectedIndex],
    correctAnswer: question.options[question.correctIndex],
    correct,
    xpEarned: baseEarned,
    coinsEarned: baseEarned,
  }

  const newHistory = [...progress.history, entry]

  // The day-streak only advances once per day, the moment this correct answer
  // brings today's distinct correct-subject count up to all 6 — answering
  // fewer than 6 doesn't advance it, and a wrong answer in one subject
  // doesn't erase a day already completed. Gating on "already credited today"
  // keeps it from double-counting if this somehow fires more than once
  // (each subject only has one daily question, so it shouldn't in practice).
  const alreadyCreditedToday = progress.lastCorrectDate === today
  let newStreak = effStreak
  let bonusEarned = 0
  let milestoneHit = null

  if (correct && !alreadyCreditedToday && countCorrectSubjectsToday(newHistory, today) >= TOTAL_SUBJECTS) {
    newStreak = effStreak + 1
    if (milestoneBonuses[newStreak]) {
      bonusEarned = milestoneBonuses[newStreak]
      milestoneHit = newStreak
    }
    entry.xpEarned += bonusEarned
    entry.coinsEarned += bonusEarned
  }

  const newProgress = {
    ...progress,
    streak: newStreak,
    longestStreak: Math.max(progress.longestStreak, newStreak),
    xp: progress.xp + entry.xpEarned,
    coins: progress.coins + entry.coinsEarned,
    lastCorrectDate: newStreak > effStreak ? today : progress.lastCorrectDate,
    history: newHistory,
  }

  return {
    progress: newProgress,
    correct,
    coinsEarned: entry.coinsEarned,
    xpEarned: entry.xpEarned,
    milestoneHit,
    bonusEarned,
  }
}
