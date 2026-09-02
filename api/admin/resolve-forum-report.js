import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const reportId = sanitizeUuid(body.report_id)
  if (!reportId) return { field: 'report_id', message: 'report_id must be a valid id.' }
  body.report_id = reportId

  if (body.action !== 'delete' && body.action !== 'dismiss') return { field: 'action', message: 'action must be "delete" or "dismiss".' }
  return null
}

async function handle({ body }) {
  const { report_id: reportId, action } = body

  const { data: report, error: reportError } = await supabase
    .from('forum_reports')
    .select('id, target_type, target_id, status')
    .eq('id', reportId)
    .maybeSingle()
  if (reportError) throw reportError
  if (!report) {
    const err = new Error('That report was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
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

export default createAdminHandler({ method: 'POST', validate, handle })
