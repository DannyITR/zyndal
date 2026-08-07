import { supabase } from './_lib/auth.js'
import { sendWeeklySummaryEmail } from './_lib/resend.js'
import { diffDays, todayStr, XP_PER_CORRECT, COINS_PER_CORRECT } from '../src/lib/streak.js'

// Vercel Cron hits this weekly (see vercel.json's crons entry, Sunday
// 13:00 UTC) — GET + Authorization: Bearer $CRON_SECRET, the same
// convention every other cron in this codebase uses (see
// api/cron/homework-reminder.js), so this is the one auth check that
// keeps it from being publicly invokable. Lives at /api/weekly-summary
// rather than under api/cron/ since that's the exact path the cron
// config points at.
//
// One email per PARENT, not per child — every one of a parent's linked
// students (up to 2 parents can now be linked to the same student, but
// that's irrelevant here: this only cares about "for this parent, which
// students are theirs") is summarized in a single send. A child with zero
// activity for the week is still listed (not skipped), just with a "no
// activity" note instead of the normal stat block — only a PARENT with
// zero linked students (or no email on file) is skipped entirely.
//
// "This past week" is a rolling 7-day window ending at run time, not a
// calendar Monday-Sunday week — the cron firing Sunday afternoon means a
// calendar-week window would already be complete by then anyway, but a
// rolling window is simpler and correct regardless of exactly when the
// cron actually runs.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' })
    return
  }

  const expected = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { data: links, error: linksError } = await supabase.from('parent_student').select('parent_id, student_id')
    if (linksError) throw linksError
    if (!links || links.length === 0) {
      res.status(200).json({ parents: 0, emailsSent: 0, errors: [] })
      return
    }

    const studentIdsByParent = {}
    for (const link of links) {
      ;(studentIdsByParent[link.parent_id] ||= new Set()).add(link.student_id)
    }
    const parentIds = Object.keys(studentIdsByParent)
    const studentIds = [...new Set(links.map((l) => l.student_id))]

    const { data: parents, error: parentsError } = await supabase
      .from('users')
      .select('id, email, language_preference')
      .in('id', parentIds)
      .eq('account_type', 'parent')
      .is('deleted_at', null)
    if (parentsError) throw parentsError

    const { data: students, error: studentsError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', studentIds)
      .is('deleted_at', null)
    if (studentsError) throw studentsError
    const studentById = Object.fromEntries((students || []).map((s) => [s.id, s]))

    const cutoffIso = new Date(Date.now() - WEEK_MS).toISOString()

    const { data: streakRows, error: streaksError } = await supabase
      .from('streaks')
      .select('user_id, current_streak, last_answered_date')
      .in('user_id', studentIds)
    if (streaksError) throw streaksError
    const streakByStudent = Object.fromEntries((streakRows || []).map((s) => [s.user_id, s]))

    const { data: weekAnswers, error: answersError } = await supabase
      .from('answers')
      .select('user_id, correct')
      .in('user_id', studentIds)
      .gte('answered_at', cutoffIso)
    if (answersError) throw answersError

    const { data: weekGrades, error: gradesError } = await supabase
      .from('grades')
      .select('user_id, subject, grade_percentage')
      .in('user_id', studentIds)
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: true })
    if (gradesError) throw gradesError

    const answersByStudent = {}
    for (const row of weekAnswers || []) (answersByStudent[row.user_id] ||= []).push(row)
    const gradesByStudent = {}
    for (const row of weekGrades || []) (gradesByStudent[row.user_id] ||= []).push(row)

    // UTC "today," not each student's own local timezone — good enough for
    // a once-a-week digest's "is this streak still fresh" check (worst
    // case, right at a student's own day boundary, off by one calendar
    // day), unlike the actual streak-crediting logic elsewhere in this
    // app, which always uses the student's real timezone.
    const today = todayStr()

    function buildChildSummary(studentId) {
      const student = studentById[studentId]
      const username = student?.username || 'Unknown'
      const weekAnswerRows = answersByStudent[studentId] || []
      const weekGradeRows = gradesByStudent[studentId] || []

      if (weekAnswerRows.length === 0 && weekGradeRows.length === 0) {
        return { username, hasActivity: false }
      }

      const streakRow = streakByStudent[studentId]
      // Same "is this streak actually still alive" gap check the app's own
      // getEffectiveStreak uses client-side (src/lib/streak.js) — a stored
      // current_streak can be stale by the time this cron runs if the
      // student hasn't answered in the last day or two.
      const effectiveStreak =
        streakRow?.last_answered_date && diffDays(today, streakRow.last_answered_date) <= 1 ? streakRow.current_streak : 0

      const correctCount = weekAnswerRows.filter((a) => a.correct).length

      return {
        username,
        hasActivity: true,
        streak: effectiveStreak,
        xpEarned: correctCount * XP_PER_CORRECT,
        coinsEarned: correctCount * COINS_PER_CORRECT,
        questionsAnswered: weekAnswerRows.length,
        grades: weekGradeRows.map((g) => ({ subject: g.subject, gradePercentage: g.grade_percentage })),
      }
    }

    let emailsSent = 0
    const errors = []

    for (const parent of parents || []) {
      if (!parent.email) continue // nothing to send to
      try {
        const children = [...studentIdsByParent[parent.id]].map(buildChildSummary)
        await sendWeeklySummaryEmail({ email: parent.email, languagePreference: parent.language_preference, children })
        emailsSent++
      } catch (err) {
        console.error(`[weekly-summary] failed for parent ${parent.id}:`, err)
        errors.push({ parentId: parent.id, message: err.message })
      }
    }

    res.status(200).json({ parents: (parents || []).length, emailsSent, errors })
  } catch (err) {
    console.error('[weekly-summary] batch failed:', err)
    res.status(500).json({ error: 'Internal error' })
  }
}
