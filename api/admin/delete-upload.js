import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const uploadId = sanitizeUuid(body.upload_id)
  if (!uploadId) return { field: 'upload_id', message: 'A valid upload_id is required.' }
  body.upload_id = uploadId
  return null
}

// upload_questions and any grade_bonuses referencing this upload cascade via
// their own FK (ON DELETE CASCADE — see supabase/schema.sql) once the
// uploads row itself goes, so nothing else needs deleting explicitly here —
// unlike the users-table hard delete, every table involved is one
// schema.sql already keeps real FK constraints on.
async function handle({ body }) {
  const { error } = await supabase.from('uploads').delete().eq('id', body.upload_id)
  if (error) throw error
  return { success: true }
}

export default createAdminHandler({ method: 'POST', validate, handle })
