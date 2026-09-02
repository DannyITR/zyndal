import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { resolveReportTargetClass } from '../_lib/forumAuth.js'

// Human label for the report's target class — a group has no name of its
// own (see school_subject_groups' schema), so it's built from the school +
// subject + grade it represents; a claimed class already has a real name.
async function classLabel(classType, classId) {
  if (classType === 'class') {
    const { data } = await supabase.from('classes').select('name').eq('id', classId).maybeSingle()
    return data?.name || 'Unknown class'
  }
  const { data: group } = await supabase.from('school_subject_groups').select('school_id, subject, grade').eq('id', classId).maybeSingle()
  if (!group) return 'Unknown group'
  const { data: school } = await supabase.from('schools').select('name').eq('id', group.school_id).maybeSingle()
  return `${school?.name || 'Unknown school'} — ${group.subject} (Grade ${group.grade})`
}

async function handle() {
  const { data: reports, error } = await supabase
    .from('forum_reports')
    .select('id, target_type, target_id, reporter_id, reason, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  if ((reports || []).length === 0) return { reports: [] }

  const reporterIds = [...new Set(reports.map((r) => r.reporter_id))]
  const { data: reporters, error: reportersError } = await supabase.from('users').select('id, username').in('id', reporterIds)
  if (reportersError) throw reportersError
  const usernameById = Object.fromEntries((reporters || []).map((u) => [u.id, u.username]))

  const enriched = await Promise.all(
    reports.map(async (r) => {
      const target = await resolveReportTargetClass(r.target_type, r.target_id)
      return {
        id: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        reporterUsername: usernameById[r.reporter_id] || 'Unknown',
        reason: r.reason,
        submittedAt: r.created_at,
        contentPreview: target ? (target.content.title ? `${target.content.title}` : target.content.body) : '[content deleted]',
        targetClassLabel: target ? await classLabel(target.class_type, target.class_id) : '—',
        contentExists: Boolean(target),
      }
    })
  )

  return { reports: enriched }
}

export default createAdminHandler({ method: 'GET', handle })
