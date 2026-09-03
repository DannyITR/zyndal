import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { resolveReportTargetClass } from '../_lib/forumAuth.js'

// Lighter version of api/admin/get-forum-reports.js — scoped to only this
// teacher's own claimed classes (class_type = 'class' AND classes.teacher_id
// = teacherId). Reports on an unclaimed group are admin-only per spec, since
// a group has no owning teacher to hand moderation to.
async function handle({ teacherId }) {
  const { data: myClasses, error: classesError } = await supabase.from('classes').select('id, name').eq('teacher_id', teacherId)
  if (classesError) throw classesError
  const myClassIds = new Set((myClasses || []).map((c) => c.id))
  const nameByClassId = Object.fromEntries((myClasses || []).map((c) => [c.id, c.name]))
  if (myClassIds.size === 0) return { reports: [] }

  const { data: reports, error } = await supabase
    .from('forum_reports')
    .select('id, target_type, target_id, reporter_id, reason, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  if ((reports || []).length === 0) return { reports: [] }

  const resolved = await Promise.all(reports.map(async (r) => ({ report: r, target: await resolveReportTargetClass(r.target_type, r.target_id) })))
  const mine = resolved.filter(({ target }) => target && target.class_type === 'class' && myClassIds.has(target.class_id))
  if (mine.length === 0) return { reports: [] }

  const reporterIds = [...new Set(mine.map(({ report }) => report.reporter_id))]
  const { data: reporters, error: reportersError } = await supabase.from('users').select('id, username').in('id', reporterIds)
  if (reportersError) throw reportersError
  const usernameById = Object.fromEntries((reporters || []).map((u) => [u.id, u.username]))

  return {
    reports: mine.map(({ report: r, target }) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reporterUsername: usernameById[r.reporter_id] || 'Unknown',
      reason: r.reason,
      submittedAt: r.created_at,
      contentPreview: target.content.title ? target.content.title : target.content.body,
      targetClassLabel: nameByClassId[target.class_id] || 'Unknown class',
      // The row still exists (it's already filtered to only reports whose
      // target resolved above) but its author may have soft-deleted it —
      // see api/forum/delete-thread.js / delete-reply.js.
      deletedByAuthor: Boolean(target.content.deletedAt),
    })),
  }
}

export default createTeacherHandler({ method: 'GET', handle })
