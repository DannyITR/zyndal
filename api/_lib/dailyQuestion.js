import { waitUntil } from '@vercel/functions'
import { supabase } from './auth.js'
import { getUserGradeAndLanguage, getAnswersThisMonth } from './db.js'
import { todayStr } from '../../src/lib/streak.js'
import { getDailyQuestionForGrade, findQuestionByPrompt } from '../../src/lib/questions.js'
import { generateQuestionPoolIfMissing } from '../questions/generate-question-pool.js'
import { LANG_FOR_PREFERENCE } from './notificationText.js'

// TODO: As students upload school materials, learn actual curriculum pacing
// per school board and replace these monthly unit estimates with real data
// per school board.
const SEASONAL_UNIT_SCHEDULE = {
  '01': [5],
  '02': [6],
  '03': [7],
  '04': [8],
  '05': [9],
  '06': [10],
  '07': [1, 2, 3],
  '08': [1, 2, 3],
  '09': [1],
  '10': [2],
  '11': [3],
  '12': [4],
}

// Small deterministic string hash (djb2) — no existing one in this
// codebase. Only needs to be stable and well-distributed, not
// cryptographic: it's just picking an index into a pool.
export function simpleHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return h >>> 0
}

async function fetchOutline(subject, grade, language) {
  const { data, error } = await supabase
    .from('curriculum_outlines')
    .select('outline_data')
    .eq('subject', subject)
    .eq('grade', grade)
    .eq('language', language)
    .maybeSingle()
  if (error) throw error
  return data
}

// Grade's curriculum outline (units -> topics), scoped to whichever unit
// number(s) the seasonal schedule points at this month. Missing outline ->
// empty result, which resolveDailyQuestion below treats as "fall back to
// hardcoded, don't auto-trigger curriculum generation as a side effect of a
// daily question request" — curriculum generation is CurriculumOutlineScreen's
// own separate on-demand flow.
// Exported for api/teacher/get-bank-questions.js's "Add random questions"
// convenience action, which needs the same "what unit(s) is this
// subject/grade on right now" resolution the daily question does — that
// caller never passes language, so it defaults to 'en' (teacher-facing bank
// stays English-only, see get-bank-questions.js).
export async function getScheduledUnits(subject, grade, timezone, language = 'en') {
  const today = todayStr(new Date(), timezone)
  const month = today.slice(5, 7)
  const scheduled = SEASONAL_UNIT_SCHEDULE[month] || [1]

  let outline = await fetchOutline(subject, grade, language)
  // A student's language outline may not have been generated/translated
  // yet — fall back to the always-present English one rather than showing
  // nothing.
  if (!outline && language !== 'en') outline = await fetchOutline(subject, grade, 'en')
  if (!outline) return []

  const units = outline.outline_data?.units || []
  if (units.length === 0) return []

  // Claude-generated curricula don't have a fixed unit count — clamp the
  // schedule's aspirational unit numbers to whatever actually exists.
  const maxUnit = units.length
  const unitNumbers = [...new Set(scheduled.map((n) => Math.min(n, maxUnit)))]

  return units.filter((u) => unitNumbers.includes(u.unit_number))
}

async function getPool(subject, grade, scheduledUnits, language) {
  const unitNumbers = scheduledUnits.map((u) => u.unit_number)
  if (unitNumbers.length === 0) return []
  const { data, error } = await supabase
    .from('generated_questions')
    .select('*')
    .eq('subject', subject)
    .eq('grade', grade)
    .eq('language', language)
    .in('unit_number', unitNumbers)
  if (error) throw error
  return data || []
}

// Fire-and-forget: every topic in the scheduled unit(s) gets a generation
// attempt via waitUntil. generateQuestionPoolIfMissing's own idempotency
// check (skip once 20 rows exist) makes this safe to call unconditionally
// rather than pre-checking counts here too.
function triggerBackgroundGeneration(subject, grade, scheduledUnits) {
  for (const unit of scheduledUnits) {
    for (const topic of unit.topics || []) {
      waitUntil(
        generateQuestionPoolIfMissing({
          subject,
          grade,
          unit_number: unit.unit_number,
          unit_title: unit.unit_title,
          topic_title: topic.topic_title,
        }).catch((err) => console.error('[dailyQuestion] background pool generation failed:', err))
      )
    }
  }
}

// Bug fix: a wide-enough (36h, same margin api/cron/streak-reminder.js
// uses) UTC lookback, narrowed to the caller's own local calendar day in JS
// — a plain UTC day-boundary query (what api/questions/get-daily-question.js
// used to do for its own separate `already_answered` flag) is wrong for any
// timezone behind/ahead of UTC.
async function getTodayAnswerRow(userId, subject, timezone, today) {
  const lookback = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('answers')
    .select('question_text, answered_at')
    .eq('user_id', userId)
    .eq('subject', subject)
    .gte('answered_at', lookback)
  if (error) throw error
  return (data || []).find((row) => todayStr(new Date(row.answered_at), timezone) === today) || null
}

// Reconstructs the full question (options, correct index, unit/topic tags)
// from just the stored question_text of an answer already submitted today —
// the same hardcoded-bank-then-generated-pool lookup order db.js's
// rowToEntry/buildGeneratedQuestionsMap already use for history entries.
// Returns null only if the text can't be matched anywhere (e.g. the
// hardcoded bank changed since it was answered), in which case the caller
// falls back to normal pool selection rather than failing outright.
async function resolveAnsweredQuestion(subject, questionText) {
  const hardcodedMatch = findQuestionByPrompt(subject, questionText)
  if (hardcodedMatch) return { ...hardcodedMatch, source: 'hardcoded', explanation: null }

  // Bug fix: generate-question-pool.js's generation runs aren't guaranteed
  // unique on (subject, question) — re-running generation for a
  // unit/topic that already has rows (e.g. across repeated testing) can
  // leave duplicate question text behind, and math's pool has picked up
  // several. .maybeSingle() errors (PGRST116, "multiple rows returned")
  // the moment more than one row matches, which this function used to
  // treat as "no match" and fall through to the pool-selection logic
  // above — silently swapping in a fresh, unanswered-looking question for
  // a subject that already had one answered today. .limit(1) caps the
  // query itself to a single (deterministic, lowest-id) row first, so
  // .maybeSingle() only ever sees 0 or 1 rows and this always resolves
  // the already-answered question correctly regardless of duplicates.
  const { data, error } = await supabase
    .from('generated_questions')
    .select('*')
    .eq('subject', subject)
    .eq('question', questionText)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[dailyQuestion] failed to look up already-answered generated question:', error)
    return null
  }
  if (!data) return null

  return {
    id: data.id,
    prompt: data.question,
    options: data.options,
    correctIndex: data.correct,
    grade: data.grade,
    unitNumber: data.unit_number,
    unitTitle: data.unit_title,
    topicTitle: data.topic_title,
    source: 'generated',
    explanation: data.explanation ?? null,
  }
}

// Shared by api/questions/get-daily-question.js (client display) and
// api/student/submit-answer.js (scoring) so both always agree on exactly
// which question is "today's" for a given student+subject — the server
// stays fully authoritative either way, mirroring how the old pure
// getDailyQuestion(subject) function worked before this feature existed.
export async function resolveDailyQuestion({ userId, subject, timezone }) {
  const [{ grade, languagePreference }, answeredThisMonth] = await Promise.all([
    getUserGradeAndLanguage(userId),
    getAnswersThisMonth(userId, subject, timezone),
  ])
  // Matches the existing client-side `user.grade || 9` fallback convention
  // used elsewhere (TestPrepSetupScreen, PracticeSetupScreen, etc.) for a
  // student whose grade was never set.
  const effectiveGrade = grade ?? 9
  const language = LANG_FOR_PREFERENCE[languagePreference] || 'en'
  const today = todayStr(new Date(), timezone)

  // Bug fix: once a subject's been answered today, THAT question — not a
  // fresh pool pick — has to stay "today's question" for the rest of the
  // day. Without this early return, a page reload after answering re-runs
  // the pool-selection loop below with `answeredThisMonth` now including
  // today's own answer; the loop treats that as "already used this month,
  // skip it" and silently swaps in a different, still-unanswered-looking
  // pool question — see api/questions/get-daily-question.js's own comment
  // on why this broke the subject screen (locked, but showing the wrong
  // question with a selectedIndex that doesn't match its options).
  const todayAnswer = await getTodayAnswerRow(userId, subject, timezone, today)
  if (todayAnswer) {
    const resolved = await resolveAnsweredQuestion(subject, todayAnswer.question_text)
    if (resolved) return resolved
  }

  let scheduledUnits = []
  try {
    scheduledUnits = await getScheduledUnits(subject, effectiveGrade, timezone, language)
  } catch (err) {
    console.error('[dailyQuestion] failed to resolve curriculum schedule, falling back to hardcoded bank:', err)
  }

  let pool = []
  if (scheduledUnits.length > 0) {
    try {
      pool = await getPool(subject, effectiveGrade, scheduledUnits, language)
      // The student's language pool may not exist yet (bulk translation
      // hasn't reached this subject/grade/unit) — fall back to English
      // rather than dropping to the hardcoded bank.
      if (pool.length === 0 && language !== 'en') {
        pool = await getPool(subject, effectiveGrade, scheduledUnits, 'en')
      }
    } catch (err) {
      console.error('[dailyQuestion] failed to load generated_questions pool, falling back to hardcoded bank:', err)
    }
  }

  if (pool.length === 0) {
    // Background generation always fills the canonical English pool (the
    // bulk script is what populates fr/es — see
    // scripts/generate-multilingual-content.js), so it needs the English
    // unit_title/topic_title, not whatever language scheduledUnits ended up
    // in above (which may have come from a translated outline).
    let englishUnits = scheduledUnits
    if (language !== 'en') {
      try {
        englishUnits = await getScheduledUnits(subject, effectiveGrade, timezone, 'en')
      } catch (err) {
        console.error('[dailyQuestion] failed to resolve English curriculum schedule for background generation:', err)
        englishUnits = []
      }
    }
    if (englishUnits.length > 0) triggerBackgroundGeneration(subject, effectiveGrade, englishUnits)
    const hardcoded = getDailyQuestionForGrade(subject, effectiveGrade, new Date(`${today}T12:00:00Z`))
    // The hardcoded bank has no authored explanation text (unlike
    // AI-generated pool questions below) — explicitly null rather than
    // absent, so callers can rely on the field always being present.
    return { ...hardcoded, source: 'hardcoded', explanation: null }
  }

  const index = simpleHash(`${userId}:${today}:${subject}`) % pool.length
  let selected = null
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(index + i) % pool.length]
    if (!answeredThisMonth.has(candidate.question)) {
      selected = candidate
      break
    }
  }
  if (!selected) {
    // Every pool question was already answered this month — realistic for
    // a daily player against a 20-question pool over a ~30-day month.
    // Repeat the hash-selected one rather than erroring.
    console.warn(`[dailyQuestion] pool exhausted this month for subject "${subject}" — repeating a question.`)
    selected = pool[index]
  }

  return {
    id: selected.id,
    prompt: selected.question,
    options: selected.options,
    correctIndex: selected.correct,
    grade: selected.grade,
    unitNumber: selected.unit_number,
    unitTitle: selected.unit_title,
    topicTitle: selected.topic_title,
    source: 'generated',
    explanation: selected.explanation ?? null,
  }
}
