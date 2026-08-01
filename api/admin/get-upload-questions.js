import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const uploadId = sanitizeUuid(body.upload_id)
  if (!uploadId) return { field: 'upload_id', message: 'A valid upload_id is required.' }
  body.upload_id = uploadId
  return null
}

async function handle({ body }) {
  const { data, error } = await supabase
    .from('upload_questions')
    .select('*')
    .eq('upload_id', body.upload_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return { questions: data || [] }
}

export default createAdminHandler({ method: 'GET', validate, handle })
