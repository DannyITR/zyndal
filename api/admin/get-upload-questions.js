import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { signSharedNoteFiles } from '../_lib/sharedNotesStorage.js'

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

  // Deliberately no deleted_at filter anywhere in this handler — an admin
  // can always review an upload a student soft-deleted (see
  // api/uploads/delete-upload.js), including the stored page images
  // of a shared one, which that soft delete leaves in place for exactly
  // this purpose.
  const { data: upload, error: uploadError } = await supabase.from('uploads').select('summary, shared_files').eq('id', body.upload_id).maybeSingle()
  if (uploadError) throw uploadError
  const [images] = await signSharedNoteFiles([upload?.shared_files])

  return { questions: data || [], summary: upload?.summary || null, images }
}

export default createAdminHandler({ method: 'GET', validate, handle })
