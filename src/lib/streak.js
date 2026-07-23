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

// The streak as it should be displayed *before* today's question is answered.
// A gap of more than one day since the last correct answer means a day was
// missed, so the streak is already broken even if the user hasn't opened the
// app to "confirm" it.
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

  // The day-streak only advances once per day, on the first correct answer of
  // that day — answering more subjects correctly the same day shouldn't inflate
  // it, and a wrong answer in one subject shouldn't erase a day already earned
  // by another subject answered correctly earlier today. Since a milestone bonus
  // can only be hit the moment the streak actually advances, gating on this same
  // flag also keeps a second correct answer the same day from re-awarding it.
  const alreadyCreditedToday = progress.lastCorrectDate === today
  let newStreak = effStreak
  let baseEarned = 0
  let bonusEarned = 0
  let milestoneHit = null

  if (correct) {
    baseEarned = XP_PER_CORRECT
    if (!alreadyCreditedToday) {
      newStreak = effStreak + 1
      if (milestoneBonuses[newStreak]) {
        bonusEarned = milestoneBonuses[newStreak]
        milestoneHit = newStreak
      }
    }
  }

  const xpEarned = baseEarned + bonusEarned
  const coinsEarned = baseEarned + bonusEarned

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
    xpEarned,
    coinsEarned,
  }

  const newProgress = {
    ...progress,
    streak: newStreak,
    longestStreak: Math.max(progress.longestStreak, newStreak),
    xp: progress.xp + xpEarned,
    coins: progress.coins + coinsEarned,
    lastCorrectDate: correct ? today : progress.lastCorrectDate,
    history: [...progress.history, entry],
  }

  return { progress: newProgress, correct, coinsEarned, xpEarned, milestoneHit, bonusEarned }
}
