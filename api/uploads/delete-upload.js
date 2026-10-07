import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const uploadId = sanitizeUuid(body.upload_id)
  if (!uploadId) return { field: 'upload_id', message: 'upload_id must be a valid id.' }
  body.upload_id = uploadId
  return null
}

// Soft delete only, same model as api/forum/delete-thread.js — deleted_at is
// set and nothing else changes: the row, its extracted questions, and its
// stored page images (see api/_lib/sharedNotesStorage.js) all stay exactly
// where they are. Every student-facing read (get-group-uploads-calendar.js,
// get-upload-questions.js, get-uploads.js) hides anything with deleted_at
// set, while the admin panel (api/admin/get-user-detail.js and
// get-upload-questions.js) keeps showing it, marked as deleted, for
// moderation — a student removing notes they shared must never be a way to
// make them unreviewable. Permanent removal stays admin-only
// (api/admin/delete-upload.js).
//
// Only the uploader can delete. Covers both of the uploader's delete
// buttons: a shared upload's row on a Notes Calendar day, and any upload
// (shared or private, a graded test included) in My Uploads. A deleted
// test's grade and any grade bonus it triggered are deliberately left as
// they are for linked parents (api/parent/get-dashboard.js doesn't filter
// on deleted_at) — deleting an upload tidies the student's own library, it
// isn't a way to withdraw a grade a parent has already been shown.
async function handle({ userId, body }) {
  const { upload_id: uploadId } = body

  const { data: upload, error: lookupError } = await supabase
    .from('uploads')
    .select('id, user_id, deleted_at')
    .eq('id', uploadId)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (!upload || upload.deleted_at) {
    const err = new Error('Upload not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (upload.user_id !== userId) {
    const err = new Error('You can only delete your own uploads.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const { error } = await supabase.from('uploads').update({ deleted_at: new Date().toISOString() }).eq('id', uploadId)
  if (error) throw error

  return { success: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
