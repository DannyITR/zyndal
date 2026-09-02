import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { resolveReportTargetClass } from '../_lib/forumAuth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const reportId = sanitizeUuid(body.report_id)
  if (!reportId) return { field: 'report_id', message: 'report_id must be a valid id.' }
  body.report_id = reportId

  if (body.action !== 'delete' && body.action !== 'dismiss') return { field: 'action', message: 'action must be "delete" or "dismiss".' }
  return null
}

async function handle({ teacherId, body }) {
  const { report_id: reportId, action } = body

  const { data: report, error: reportError } = await supabase
    .from('forum_reports')
    .select('id, target_type, target_id')
    .eq('id', reportId)
    .maybeSingle()
  if (reportError) throw reportError
  if (!report) {
    const err = new Error('That report was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  // Re-verify ownership server-side even though the list this came from was
  // already filtered — never trust a report_id a client could have typed in
  // directly to bypass the teacher's own class scope.
  const target = await resolveReportTargetClass(report.target_type, report.target_id)
  if (!target || target.class_type !== 'class') {
    const err = new Error('You do not have access to this report.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }
  const { data: cls, error: classError } = await supabase.from('classes').select('teacher_id').eq('id', target.class_id).maybeSingle()
  if (classError) throw classError
  if (!cls || cls.teacher_id !== teacherId) {
    const err = new Error('You do not have access to this report.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  if (action === 'delete') {
    const table = report.target_type === 'thread' ? 'forum_threads' : 'forum_replies'
    const { error: deleteError } = await supabase.from(table).delete().eq('id', report.target_id)
    if (deleteError) throw deleteError
  }

  const { data: updated, error: updateError } = await supabase
    .from('forum_reports')
    .update({ status: 'reviewed' })
    .eq('id', reportId)
    .select()
    .single()
  if (updateError) throw updateError

  return { report: updated }
}

export default createTeacherHandler({ method: 'POST', validate, handle })
