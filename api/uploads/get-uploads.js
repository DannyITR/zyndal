import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Mirrors getUploadsForUser in storage.js, plus a questionCount per upload
// as spec'd (supabase-js has no GROUP BY, so counts are computed in JS from
// a single upload_id-only query rather than one COUNT query per upload).
function validate(body) {
  if (body.subject !== undefined && typeof body.subject !== 'string') return 'subject must be a string.'
  return null
}

async function handle({ userId, body }) {
  let query = supabase.from('uploads').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (body.subject) query = query.eq('subject', body.subject)
  const { data: uploads, error } = await query
  if (error) throw error
  if (!uploads || uploads.length === 0) return []

  const uploadIds = uploads.map((u) => u.id)
  const { data: questionRows, error: questionsError } = await supabase
    .from('upload_questions')
    .select('upload_id')
    .in('upload_id', uploadIds)
  if (questionsError) throw questionsError

  const countByUpload = {}
  for (const row of questionRows || []) {
    countByUpload[row.upload_id] = (countByUpload[row.upload_id] || 0) + 1
  }

  return uploads.map((u) => ({ ...u, questionCount: countByUpload[u.id] || 0 }))
}

export default createStudentHandler({ method: 'GET', validate, handle })
