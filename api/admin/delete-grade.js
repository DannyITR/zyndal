import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const gradeId = sanitizeUuid(body.grade_id)
  if (!gradeId) return { field: 'grade_id', message: 'A valid grade_id is required.' }
  body.grade_id = gradeId
  return null
}

// Any grade_bonuses row referencing this grade cascades via its own FK (ON
// DELETE CASCADE — see supabase/schema.sql), so nothing else needs deleting
// explicitly here.
async function handle({ body }) {
  const { error } = await supabase.from('grades').delete().eq('id', body.grade_id)
  if (error) throw error
  return { success: true }
}

export default createAdminHandler({ method: 'POST', validate, handle })
