import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { assertPremium } from '../_lib/subscription.js'
import { getForumMembership } from '../_lib/forumAuth.js'
import { signSharedNoteFiles } from '../_lib/sharedNotesStorage.js'

// Two modes:
//  - upload_id: returns { upload, questions } — backs getUploadDetail in
//    storage.js. The spec describes this endpoint as returning only
//    "questions", but every upload_id caller in the app also needs the
//    upload's own metadata (subject, topic, grade, timestamps) in the same
//    call, so it's included here rather than forcing a second round trip
//    to get-uploads.js just to find one row by id. Scoped to the caller's
//    own uploads OR, if the upload was shared with a group (see
//    save-shared-upload.js), any member of that group — the Group Notes
//    Calendar reuses this exact same detail view for a groupmate's shared
//    upload rather than needing its own separate display component.
//  - subject: returns { uploads: [...] }, one entry per upload with its raw
//    question rows — always scoped to the caller's own uploads (this mode
//    backs test-prep pooling from a student's own uploaded material, never
//    a groupmate's), storage.js reshapes this into BOTH
//    getUploadedContentForSubject's grouped/usable-questions shape and
//    getUploadedQuestions' topic-filtered flat shape, so this one query
//    covers both existing callers without the endpoint itself needing to
//    know which shape the caller ultimately wants.
function validate(body) {
  if (!body.upload_id && !body.subject) return 'upload_id or subject is required.'
  return null
}

async function handleByUploadId(userId, uploadId) {
  const { data: upload, error } = await supabase.from('uploads').select('*').eq('id', uploadId).maybeSingle()
  if (error) throw error
  // A soft-deleted shared upload (see delete-upload.js) reads as
  // gone to everyone here, its own uploader included — only the admin
  // panel's separate endpoints still serve it.
  if (!upload || upload.deleted_at) {
    const err = new Error('Upload not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const isOwner = upload.user_id === userId
  let uploaderUsername = null

  if (isOwner) {
    // Only the owner's own view of their own upload is premium-gated,
    // exactly as before this feature — a groupmate viewing a shared
    // upload below never hits this, per the product decision that no part
    // of Group Notes Calendar is gated during the current growth phase.
    await assertPremium(userId)
  } else {
    const sharedMembership = upload.shared_class_id
      ? await getForumMembership(userId, upload.shared_class_type, upload.shared_class_id)
      : { member: false }
    if (!sharedMembership.member) {
      const err = new Error('Upload not found.')
      err.status = 404
      err.code = 'NOT_FOUND'
      throw err
    }
    const { data: uploader, error: uploaderError } = await supabase.from('users').select('username').eq('id', upload.user_id).maybeSingle()
    if (uploaderError) throw uploaderError
    uploaderUsername = uploader?.username || null
  }

  const { data: questions, error: questionsError } = await supabase
    .from('upload_questions')
    .select('*')
    .eq('upload_id', uploadId)
    .order('created_at', { ascending: true })
  if (questionsError) throw questionsError

  // Reaching here means the caller is either the uploader or a confirmed
  // member of the class it was shared with (anyone else got the 404 above),
  // so it's safe to mint read URLs for the stored pages. The raw storage
  // paths themselves never leave the server.
  const { shared_files: sharedFiles, ...uploadFields } = upload
  const [images] = await signSharedNoteFiles([sharedFiles])
  return { upload: { ...uploadFields, uploaderUsername, images }, questions: questions || [] }
}

async function handleBySubject(userId, subject) {
  const { data: uploads, error: uploadsError } = await supabase
    .from('uploads')
    .select('id, topic, summary, key_concepts')
    .eq('user_id', userId)
    .eq('subject', subject)
    .is('deleted_at', null)
  if (uploadsError) throw uploadsError
  if (!uploads || uploads.length === 0) return { uploads: [] }

  const uploadIds = uploads.map((u) => u.id)
  const { data: questions, error: questionsError } = await supabase
    .from('upload_questions')
    .select('upload_id, question, correct_answer, options, explanation')
    .in('upload_id', uploadIds)
  if (questionsError) throw questionsError

  return {
    uploads: uploads.map((u) => ({
      uploadId: u.id,
      topic: u.topic,
      summary: u.summary,
      keyConcepts: u.key_concepts || [],
      questions: (questions || []).filter((q) => q.upload_id === u.id),
    })),
  }
}

async function handle({ userId, body }) {
  if (body.upload_id) return handleByUploadId(userId, body.upload_id)
  await assertPremium(userId)
  return handleBySubject(userId, body.subject)
}

export default createStudentHandler({ method: 'GET', validate, handle })
