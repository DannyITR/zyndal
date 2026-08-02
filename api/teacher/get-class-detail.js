import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { getEffectiveStreak, todayStr } from '../../src/lib/streak.js'

function validate(body) {
  const classId = sanitizeUuid(body.class_id)
  if (!classId) return { field: 'class_id', message: 'A valid class_id is required.' }
  body.class_id = classId
  return null
}

async function handle({ teacherId, body }) {
  const { data: classRow, error: classError } = await supabase.from('classes').select('*').eq('id', body.class_id).maybeSingle()
  if (classError) throw classError
  if (!classRow || classRow.teacher_id !== teacherId) {
    const err = new Error('Class not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: enrollments, error: enrollError } = await supabase
    .from('class_students')
    .select('student_id, joined_at')
    .eq('class_id', body.class_id)
  if (enrollError) throw enrollError
  const studentIds = (enrollments || []).map((e) => e.student_id)

  const [studentUsersResult, streakRowsResult, answerRowsResult, assignmentsResult] = await Promise.all([
    studentIds.length ? supabase.from('users').select('id, username, avatar, grade').in('id', studentIds) : { data: [] },
    studentIds.length ? supabase.from('streaks').select('*').in('user_id', studentIds) : { data: [] },
    studentIds.length
      ? supabase.from('answers').select('user_id, answered_at').in('user_id', studentIds).order('answered_at', { ascending: false })
      : { data: [] },
    supabase.from('homework_assignments').select('*').eq('class_id', body.class_id).order('due_date', { ascending: false }),
  ])
  if (studentUsersResult.error) throw studentUsersResult.error
  if (streakRowsResult.error) throw streakRowsResult.error
  if (answerRowsResult.error) throw answerRowsResult.error
  if (assignmentsResult.error) throw assignmentsResult.error

  const today = todayStr()
  const streakByStudent = Object.fromEntries((streakRowsResult.data || []).map((s) => [s.user_id, s]))
  const userById = Object.fromEntries((studentUsersResult.data || []).map((u) => [u.id, u]))
  const lastActiveByStudent = {}
  for (const row of answerRowsResult.data || []) {
    if (!lastActiveByStudent[row.user_id]) lastActiveByStudent[row.user_id] = row.answered_at
  }

  const students = (enrollments || []).map((e) => {
    const u = userById[e.student_id]
    const streak = streakByStudent[e.student_id]
    return {
      studentId: e.student_id,
      username: u?.username || 'Unknown',
      avatar: u?.avatar || null,
      grade: u?.grade || null,
      joinedAt: e.joined_at,
      currentStreak: streak ? getEffectiveStreak({ streak: streak.current_streak, lastCorrectDate: streak.last_answered_date }, today) : 0,
      totalXp: streak?.total_xp ?? 0,
      lastActive: lastActiveByStudent[e.student_id] || null,
    }
  })

  const assignments = assignmentsResult.data || []
  const assignmentIds = assignments.map((a) => a.id)
  const { data: submissions, error: submissionsError } = assignmentIds.length
    ? await supabase.from('homework_submissions').select('*').in('assignment_id', assignmentIds)
    : { data: [] }
  if (submissionsError) throw submissionsError

  // Scratchpad is Math-only — other subjects may be added in future.
  // "Pending Work Reviews" badge — count only, not the rows themselves;
  // get-submission-detail.js is where a teacher actually reviews each one.
  const { count: pendingWorkReviewCount, error: pendingWorkError } = assignmentIds.length
    ? await supabase
        .from('work_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('review_type', 'teacher')
        .is('approved', null)
        .in('assignment_id', assignmentIds)
    : { count: 0, error: null }
  if (pendingWorkError) throw pendingWorkError

  const submissionsByAssignment = {}
  for (const s of submissions || []) {
    ;(submissionsByAssignment[s.assignment_id] ||= []).push(s)
  }

  const enrichedAssignments = assignments.map((a) => {
    const subs = submissionsByAssignment[a.id] || []
    const completed = subs.filter((s) => s.completed_at)
    const avgScore =
      completed.length > 0 ? Math.round(completed.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / completed.length) : null
    const submissionByStudent = Object.fromEntries(subs.map((s) => [s.student_id, s]))
    return {
      id: a.id,
      title: a.title,
      subject: a.subject,
      dueDate: a.due_date,
      createdAt: a.created_at,
      questionCount: Array.isArray(a.questions) ? a.questions.length : 0,
      totalEnrolled: students.length,
      completedCount: completed.length,
      averageScorePercent: avgScore,
      students: students.map((st) => {
        const sub = submissionByStudent[st.studentId]
        return {
          studentId: st.studentId,
          username: st.username,
          status: sub?.completed_at ? 'completed' : 'not_submitted',
          scorePercentage: sub?.score_percentage ?? null,
          completedAt: sub?.completed_at || null,
        }
      }),
    }
  })

  return {
    class: classRow,
    students,
    assignments: enrichedAssignments,
    leaderboard: [...students].sort((a, b) => b.totalXp - a.totalXp),
    pendingWorkReviewCount: pendingWorkReviewCount || 0,
  }
}

export default createTeacherHandler({ method: 'GET', validate, handle })
