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

// Messages have no soft-delete concept (unlike forum posts) — "Delete" here
// permanently removes the message row itself.
async function handle({ body }) {
  const { report_id: reportId, action } = body

  const { data: report, error: reportError } = await supabase.from('message_reports').select('id, target_id').eq('id', reportId).maybeSingle()
  if (reportError) throw reportError
  if (!report) {
    const err = new Error('That report was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  if (action === 'delete') {
    const { error: deleteError } = await supabase.from('messages').delete().eq('id', report.target_id)
    if (deleteError) throw deleteError
  }

  const { data: updated, error: updateError } = await supabase
    .from('message_reports')
    .update({ status: 'reviewed' })
    .eq('id', reportId)
    .select()
    .single()
  if (updateError) throw updateError

  return { report: updated }
}

export default createAdminHandler({ method: 'POST', validate, handle })
