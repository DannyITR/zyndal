import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { getEffectiveStreak, todayStr } from '../../src/lib/streak.js'
import { resolveClassSubject } from '../_lib/classSubject.js'

function validate(body) {
  const classId = sanitizeUuid(body.class_id)
  if (!classId) return { field: 'class_id', message: 'A valid class_id is required.' }
  body.class_id = classId
  return null
}

// Scoped strictly to a class this teacher owns (classRow.teacher_id check
// below) — a teacher can never pull roster/grade data for another
// teacher's class or an unclaimed group they don't manage, since this
// endpoint only ever accepts a classes.id, never a school_subject_groups.id.
async function handle({ teacherId, body }) {
  const { data: classRow, error: classError } = await supabase.from('classes').select('*').eq('id', body.class_id).maybeSingle()
  if (classError) throw classError
  if (!classRow || classRow.teacher_id !== teacherId) {
    const err = new Error('Class not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const subject = resolveClassSubject(classRow)

  const { data: enrollments, error: enrollError } = await supabase.from('class_students').select('student_id').eq('class_id', body.class_id)
  if (enrollError) throw enrollError
  const studentIds = (enrollments || []).map((e) => e.student_id)
  if (studentIds.length === 0) return { class: { id: classRow.id, name: classRow.name, subject }, roster: [] }

  const today = todayStr()

  const [usersResult, streaksResult, todayAnswersResult, assignmentsResult, gradesResult] = await Promise.all([
    supabase.from('users').select('id, username, display_name').in('id', studentIds),
    supabase.from('streaks').select('*').in('user_id', studentIds),
    // "Daily question done today" is independent of this class's own
    // subject — only one subject rotates in as the answerable daily
    // question app-wide each day (src/lib/questions.js's
    // getTodaysSubjectId), so scoping this to the class's subject would
    // show "not done" for the whole roster on every day that isn't this
    // subject's turn. This just answers "did they do today's question at
    // all," matching the plain daily-engagement signal a teacher wants.
    supabase.from('answers').select('user_id, answered_at').in('user_id', studentIds),
    supabase.from('homework_assignments').select('id').eq('class_id', body.class_id),
    // Grades ARE scoped to this class's own subject — grades carry no
    // class_id at all (see schema.sql), so subject is the only signal
    // tying a grade to "this class" rather than the student's other
    // classes. Skipped entirely if the class's subject can't be resolved
    // (a legacy class with no subject match — see classSubject.js).
    subject ? supabase.from('grades').select('user_id, grade_percentage').eq('subject', subject).in('user_id', studentIds) : { data: [] },
  ])
  if (usersResult.error) throw usersResult.error
  if (streaksResult.error) throw streaksResult.error
  if (todayAnswersResult.error) throw todayAnswersResult.error
  if (assignmentsResult.error) throw assignmentsResult.error
  if (gradesResult.error) throw gradesResult.error

  const userById = Object.fromEntries((usersResult.data || []).map((u) => [u.id, u]))
  const streakByStudent = Object.fromEntries((streaksResult.data || []).map((s) => [s.user_id, s]))

  const answeredTodayByStudent = new Set(
    (todayAnswersResult.data || []).filter((a) => a.answered_at.slice(0, 10) === today).map((a) => a.user_id)
  )

  const assignmentIds = (assignmentsResult.data || []).map((a) => a.id)
  const { data: submissions, error: submissionsError } = assignmentIds.length
    ? await supabase.from('homework_submissions').select('student_id, completed_at').in('assignment_id', assignmentIds)
    : { data: [] }
  if (submissionsError) throw submissionsError
  const homeworkCompletedByStudent = {}
  for (const s of submissions || []) {
    if (s.completed_at) homeworkCompletedByStudent[s.student_id] = (homeworkCompletedByStudent[s.student_id] || 0) + 1
  }
  const homeworkTotal = assignmentIds.length

  const gradesByStudent = {}
  for (const g of gradesResult.data || []) {
    ;(gradesByStudent[g.user_id] ||= []).push(g.grade_percentage)
  }

  const roster = studentIds.map((studentId) => {
    const u = userById[studentId]
    const streak = streakByStudent[studentId]
    const grades = gradesByStudent[studentId] || []
    return {
      studentId,
      username: u?.username || 'Unknown',
      displayName: u?.display_name || null,
      currentStreak: streak ? getEffectiveStreak({ streak: streak.current_streak, lastCorrectDate: streak.last_answered_date }, today) : 0,
      totalXp: streak?.total_xp ?? 0,
      dailyQuestionDoneToday: answeredTodayByStudent.has(studentId),
      homeworkCompleted: homeworkCompletedByStudent[studentId] || 0,
      homeworkTotal,
      averageGrade: grades.length > 0 ? Math.round(grades.reduce((sum, g) => sum + g, 0) / grades.length) : null,
    }
  })

  return { class: { id: classRow.id, name: classRow.name, subject }, roster }
}

export default createTeacherHandler({ method: 'GET', validate, handle })
