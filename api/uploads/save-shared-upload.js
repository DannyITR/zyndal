import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getForumMembership } from '../_lib/forumAuth.js'
import { assertUploadPagesAllowed } from '../_lib/uploadLimits.js'
import { screenUploadImages } from '../_lib/uploadSafety.js'
import { sanitizeSubject, sanitizeString, sanitizeUuid } from '../_lib/sanitize.js'

// Deliberately NOT premium-gated (see save-upload.js's sibling assertPremium
// call, which this endpoint has no equivalent of) — per explicit product
// direction, no feature added during the current growth phase should gate
// on subscription status, and this is a brand-new endpoint rather than one
// inheriting older gating by accident.
//
// Sharing is offered only for Study Material uploads (worksheets/textbook
// pages/notes), never a graded test — showing a whole group one student's
// test grade would leak private academic performance data that nothing in
// the feature request asked for. document_type is restricted accordingly
// below as the server-side backstop; the client only ever offers the
// "share with group" checkbox when uploadType === 'study_material' in the
// first place (see UploadCaptureScreen.jsx).
const SHAREABLE_DOCUMENT_TYPES = ['worksheet', 'textbook', 'notes']
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_PAGES = 5

function validate(body) {
  const groupId = sanitizeUuid(body.group_id)
  if (!groupId) return { field: 'group_id', message: 'group_id must be a valid id.' }
  body.group_id = groupId

  if (typeof body.shared_for_date !== 'string' || !DATE_PATTERN.test(body.shared_for_date)) {
    return { field: 'shared_for_date', message: 'shared_for_date is required and must be a YYYY-MM-DD date.' }
  }

  const subject = sanitizeSubject(body.subject)
  if (!subject) return { field: 'subject', message: 'subject must be a valid subject.' }
  body.subject = subject

  const topic = sanitizeString(body.topic, 100)
  if (!topic) return { field: 'topic', message: 'topic is required and must be 1-100 characters.' }
  body.topic = topic

  if (!SHAREABLE_DOCUMENT_TYPES.includes(body.document_type)) {
    return { field: 'document_type', message: 'document_type must be one of worksheet, textbook, notes.' }
  }

  if (body.notes !== undefined && body.notes !== null && body.notes !== '') {
    body.notes = sanitizeString(body.notes, 500)
  }

  if (!Array.isArray(body.files) || body.files.length === 0) return { field: 'files', message: 'files must be a non-empty array.' }
  if (body.files.length > MAX_PAGES) return { field: 'files', message: `files cannot exceed ${MAX_PAGES} pages.` }
  for (const file of body.files) {
    if (!file || typeof file.base64 !== 'string' || !file.base64) return { field: 'files', message: 'each file must include base64 data.' }
    if (!file.mediaType || typeof file.mediaType !== 'string') return { field: 'files', message: 'each file must include a mediaType.' }
  }

  return null
}

async function handle({ userId, body }) {
  const {
    group_id: groupId,
    shared_for_date: sharedForDate,
    subject,
    topic,
    notes,
    summary,
    key_concepts: keyConcepts,
    document_type: documentType,
    pages_count: pagesCount,
    files,
    timezone,
  } = body
  const newPages = pagesCount ?? 1

  const membership = await getForumMembership(userId, 'group', groupId)
  if (!membership.member) {
    const err = new Error('You are not a member of this group.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  // Same soft weekly cap as a private upload (api/uploads/save-upload.js) —
  // sharing must not be a way to dodge it.
  await assertUploadPagesAllowed({ userId, subject, timezone, newPages })

  // Authoritative, blocking check — never trust a client-reported "this
  // passed" flag for something images-based like this, matching
  // create-thread.js's own comment on why its profanity check is
  // re-verified server-side rather than trusted from the client. Nothing
  // is inserted at all if this flags the content.
  const { flagged } = await screenUploadImages(files)
  if (flagged) {
    const err = new Error('This upload was flagged as inappropriate and was not shared.')
    err.status = 400
    err.code = 'INAPPROPRIATE_CONTENT'
    throw err
  }

  const { data, error } = await supabase
    .from('uploads')
    .insert({
      user_id: userId,
      document_type: documentType,
      subject,
      topic,
      notes: notes ?? null,
      summary: summary ?? null,
      key_concepts: keyConcepts ?? null,
      pages_count: newPages,
      shared_group_id: groupId,
      shared_for_date: sharedForDate,
    })
    .select()
    .single()
  if (error) throw error

  return data
}

export default createStudentHandler({ method: 'POST', validate, handle })
