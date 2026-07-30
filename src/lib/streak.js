// XP and coins earn at the same rate: 1 per correct answer, plus a one-time
// bonus (added to both) the day a streak milestone is hit.
export const XP_PER_CORRECT = 1
export const COINS_PER_CORRECT = 1
// Parents can override these per-family (see users.milestone_settings); this
// is the fallback for students with no linked parent or no custom settings.
export const DEFAULT_MILESTONE_BONUSES = { 7: 10, 14: 20, 30: 50 }

// Matches the default on users.timezone in supabase/schema.sql — used
// whenever a request doesn't send a (valid) timezone, e.g. an old cached
// frontend bundle or a non-browser client.
export const DEFAULT_TIMEZONE = 'America/Toronto'

// Without a timeZone, "today" is UTC midnight — wrong for every Quebec user
// between 8pm and midnight local time (UTC-4/-5 depending on DST), who'd
// see tomorrow's date hours before their own midnight. With one, this
// renders the given instant as a calendar date IN that zone instead —
// en-CA's default numeric date format is already YYYY-MM-DD, so no
// reformatting is needed after Intl does the zone conversion. Falls back to
// UTC if timeZone is present but not a real IANA zone name (Intl throws a
// RangeError rather than silently ignoring it) — callers should prefer
// isValidTimeZone/DEFAULT_TIMEZONE over relying on this fallback, but it's
// here so a bad value can never crash date math.
export function todayStr(date = new Date(), timeZone) {
  if (!timeZone) return date.toISOString().slice(0, 10)
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

// Guards every timezone value this app ever accepts from a client before
// it reaches todayStr/Intl — used both server-side (request body/query) and
// nowhere client-side today, since getUserTimeZone() (src/lib/timezone.js)
// already reads a real zone straight from the browser.
export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false
  try {
    new Intl.DateTimeFormat(undefined, { timeZone })
    return true
  } catch {
    return false
  }
}

// The UTC instant for local noon on dateStr in the given timezone — used by
// api/student/submit-late-answer.js to store a Day Review "late answer" with
// an answered_at that todayStr()/rowToEntry() will correctly bucket back to
// that exact past date, not "today" or the wrong neighbouring day. Noon
// (rather than, say, midnight) keeps this safely away from both the
// UTC-day boundary and any local DST transition, which never happens at
// solar noon.
//
// Works by guessing noon UTC, reading what that instant's wall-clock time
// actually is IN the target zone (which reflects that zone's real offset —
// including DST — at that specific moment, not a fixed year-round value),
// then shifting by the difference between that reading and true noon. This
// stays correct across a DST transition on the target date because the
// probe instant (noon UTC) is only ever a few hours from true local noon,
// nowhere near when a transition would actually occur (always in the small
// hours of the morning).
export function localNoonUtc(dateStr, timeZone) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const guessUtc = Date.UTC(year, month - 1, day, 12, 0, 0)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, hour: '2-digit', minute: '2-digit' })
      .formatToParts(guessUtc)
      .map((p) => [p.type, p.value])
  )
  const localHour = Number(parts.hour) % 24 // Intl can format midnight as "24"
  const localMinute = Number(parts.minute)
  const offsetMinutes = localHour * 60 + localMinute - 12 * 60
  return new Date(guessUtc - offsetMinutes * 60000)
}

function diffDays(laterStr, earlierStr) {
  const later = new Date(laterStr + 'T00:00:00Z')
  const earlier = new Date(earlierStr + 'T00:00:00Z')
  return Math.round((later - earlier) / 86400000)
}

// The day Zyndal launched — also the ← bound on the home screen's date-nav
// bar, so a student can't navigate into dates with no possible data.
export const LAUNCH_DATE = '2026-07-22'

// Same UTC-midnight string-math pattern as mondayOfWeek below.
export function addDaysStr(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

// Client-side equivalent of api/student/get-daily-progress.js's
// computeDailyState — reused for past dates, whose data never changes and
// is already fully loaded in progress.history, so no extra API round trip
// is needed the way "today" needs one (see get-daily-progress.js's header
// comment on why today's own bucketing must be server-computed instead).
export function computeDayState(history, date) {
  const completedIds = new Set()
  const attemptedIds = new Set()
  for (const entry of history) {
    if (entry.date !== date) continue
    attemptedIds.add(entry.subjectId)
    if (entry.correct) completedIds.add(entry.subjectId)
  }
  const incorrectIds = new Set([...attemptedIds].filter((id) => !completedIds.has(id)))
  return { completedIds, incorrectIds }
}

// "July 28, 2026" — shared by the date-nav bar, the subject screen header,
// and the share card.
export function formatLongDate(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Number of daily subjects — still used for the "X/6 completed today"
// display and score box, but no longer gates the day streak itself (see
// applyDailyAnswer below: one correct first-attempt answer, in any subject,
// is now enough to keep the streak alive for the day).
export const TOTAL_SUBJECTS = 6

// Index 0-6 maps to today's correct-answer count — red at 0, full green at
// 6. Used by the visual share card (ShareStreakScreen.jsx) and the
// read-only friend score card (FriendScoreCardModal.jsx).
export const SCORE_COLORS = ['#ff5c7a', '#ff8c42', '#ffab5e', '#ffe066', '#d4e157', '#8bc34a', '#34e0a1']

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

  // The day-streak advances the moment the FIRST correct first-attempt
  // answer of the day lands, in any subject — it no longer requires all 6.
  // A wrong answer never erases a day already secured. Gating on "already
  // credited today" keeps a 2nd/3rd/etc. correct answer that same day from
  // double-incrementing.
  const alreadyCreditedToday = progress.lastCorrectDate === today
  let newStreak = effStreak
  let bonusEarned = 0
  let milestoneHit = null

  if (correct && !alreadyCreditedToday) {
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
