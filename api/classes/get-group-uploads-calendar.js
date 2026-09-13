import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getForumMembership } from '../_lib/forumAuth.js'
import { sanitizeUuid, sanitizeInteger } from '../_lib/sanitize.js'

// Mirrors api/classes/get-class-homework-calendar.js's exact month/year
// bounds logic — same pad/firstDay/lastDay pattern — backed by shared
// uploads (uploads.shared_group_id/shared_for_date) instead of homework
// assignments. Deliberately NOT premium-gated, matching
// save-shared-upload.js's own comment on why.
function pad(n) {
  return String(n).padStart(2, '0')
}

function validate(body) {
  const groupId = sanitizeUuid(body.group_id)
  if (!groupId) return { field: 'group_id', message: 'A valid group_id is required.' }
  body.group_id = groupId

  const month = sanitizeInteger(body.month, 1, 12)
  if (!month) return { field: 'month', message: 'month must be a whole number between 1 and 12.' }
  body.month = month

  const year = sanitizeInteger(body.year, 2020, 2100)
  if (!year) return { field: 'year', message: 'year must be a whole number between 2020 and 2100.' }
  body.year = year

  return null
}

async function handle({ userId, body }) {
  const membership = await getForumMembership(userId, 'group', body.group_id)
  if (!membership.member) {
    const err = new Error('You are not a member of this group.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const firstDay = `${body.year}-${pad(body.month)}-01`
  const lastDayNum = new Date(Date.UTC(body.year, body.month, 0)).getUTCDate()
  const lastDay = `${body.year}-${pad(body.month)}-${pad(lastDayNum)}`

  const { data: uploads, error: uploadsError } = await supabase
    .from('uploads')
    .select('id, user_id, subject, topic, document_type, pages_count, shared_for_date, created_at')
    .eq('shared_group_id', body.group_id)
    .gte('shared_for_date', firstDay)
    .lte('shared_for_date', lastDay)
    .order('shared_for_date', { ascending: true })
  if (uploadsError) throw uploadsError
  if (!uploads || uploads.length === 0) return { uploads: [] }

  const uploaderIds = [...new Set(uploads.map((u) => u.user_id))]
  const { data: uploaders, error: uploadersError } = await supabase.from('users').select('id, username').in('id', uploaderIds)
  if (uploadersError) throw uploadersError
  const usernameById = Object.fromEntries((uploaders || []).map((u) => [u.id, u.username]))

  return {
    uploads: uploads.map((u) => ({
      id: u.id,
      uploaderUsername: usernameById[u.user_id] || null,
      subject: u.subject,
      topic: u.topic,
      documentType: u.document_type,
      pagesCount: u.pages_count || 1,
      sharedForDate: u.shared_for_date,
      createdAt: u.created_at,
    })),
  }
}

export default createStudentHandler({ method: 'GET', validate, handle })
