import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getForumMembership, resolveReportTargetClass } from '../_lib/forumAuth.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'

function validate(body) {
  if (body.target_type !== 'thread' && body.target_type !== 'reply') return { field: 'target_type', message: 'target_type must be "thread" or "reply".' }
  const targetId = sanitizeUuid(body.target_id)
  if (!targetId) return { field: 'target_id', message: 'target_id must be a valid id.' }
  body.target_id = targetId

  const reason = sanitizeString(body.reason, 500)
  if (!reason) return { field: 'reason', message: 'A reason is required.' }
  body.reason = reason

  return null
}

async function handle({ userId, body }) {
  const { target_type: targetType, target_id: targetId, reason } = body

  const target = await resolveReportTargetClass(targetType, targetId)
  if (!target) {
    const err = new Error('That content was not found — it may have already been removed.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const membership = await getForumMembership(userId, target.class_type, target.class_id)
  if (!membership.member) {
    const err = new Error('You are not a member of this class.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const { data: report, error } = await supabase
    .from('forum_reports')
    .insert({ target_type: targetType, target_id: targetId, reporter_id: userId, reason, status: 'pending' })
    .select()
    .single()
  if (error) throw error

  return { report }
}

export default createStudentHandler({ method: 'POST', validate, handle })
