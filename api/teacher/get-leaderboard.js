import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { fetchLeaderboardRows } from '../_lib/db.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  if (body.class_id !== undefined && body.class_id !== '') {
    const classId = sanitizeUuid(body.class_id)
    if (!classId) return { field: 'class_id', message: 'Invalid class_id.' }
    body.class_id = classId
  } else {
    body.class_id = null
  }
  return null
}

async function handle({ teacherId, body }) {
  if (!body.class_id) {
    return { leaderboard: await fetchLeaderboardRows() }
  }

  const { data: classRow, error: classError } = await supabase.from('classes').select('teacher_id').eq('id', body.class_id).maybeSingle()
  if (classError) throw classError
  if (!classRow || classRow.teacher_id !== teacherId) {
    const err = new Error('Class not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: enrollments, error: enrollError } = await supabase.from('class_students').select('student_id').eq('class_id', body.class_id)
  if (enrollError) throw enrollError
  const studentIds = (enrollments || []).map((e) => e.student_id)
  if (studentIds.length === 0) return { leaderboard: [] }

  return { leaderboard: await fetchLeaderboardRows(studentIds) }
}

export default createTeacherHandler({ method: 'GET', validate, handle })
