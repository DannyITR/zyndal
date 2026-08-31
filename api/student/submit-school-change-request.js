import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeString, sanitizeImageBase64 } from '../_lib/sanitize.js'

// Client-side resizeImageToBase64 (src/lib/imageUtils.js) already downscales
// to ~1568px/JPEG 0.85 before this ever gets sent — this cap is just
// defense-in-depth against a direct API call bypassing that resize, not a
// realistic size for a normal submission.
const MAX_BASE64_LENGTH = 8_000_000

function validate(body) {
  if (body.requested_school_id !== undefined && body.requested_school_id !== null) {
    const schoolId = sanitizeUuid(body.requested_school_id)
    if (!schoolId) return { field: 'requested_school_id', message: 'requested_school_id must be a valid school id.' }
    body.requested_school_id = schoolId
  }

  if (body.requested_school_name !== undefined && body.requested_school_name !== null && body.requested_school_name !== '') {
    const name = sanitizeString(body.requested_school_name, 100)
    if (!name) return { field: 'requested_school_name', message: 'requested_school_name must be 1-100 characters.' }
    body.requested_school_name = name
  }

  if (!body.requested_school_id && !body.requested_school_name) {
    return { field: 'requested_school_id', message: 'Either requested_school_id or requested_school_name is required.' }
  }

  if (typeof body.proof_image_base64 !== 'string' || body.proof_image_base64.length > MAX_BASE64_LENGTH) {
    return { field: 'proof_image_base64', message: 'proof_image_base64 must be a valid image.' }
  }
  const image = sanitizeImageBase64(body.proof_image_base64)
  if (!image) return { field: 'proof_image_base64', message: 'A proof photo is required.' }
  body.proof_image_base64 = image

  return null
}

async function handle({ userId, body }) {
  const { requested_school_id: requestedSchoolId, requested_school_name: requestedSchoolName, proof_image_base64: proofImageBase64 } = body

  const { data: user, error: userError } = await supabase.from('users').select('school_id').eq('id', userId).maybeSingle()
  if (userError) throw userError
  if (!user?.school_id) {
    const err = new Error('Set your school in Settings first — no proof is needed the first time.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  if (requestedSchoolId) {
    const { data: schoolRow, error: schoolError } = await supabase.from('schools').select('id').eq('id', requestedSchoolId).maybeSingle()
    if (schoolError) throw schoolError
    if (!schoolRow) {
      const err = new Error('Unknown school.')
      err.status = 400
      err.code = 'VALIDATION_ERROR'
      throw err
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('school_change_requests')
    .select('id')
    .eq('student_id', userId)
    .eq('status', 'pending')
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) {
    const err = new Error('You already have a school change request awaiting review.')
    err.status = 400
    err.code = 'ALREADY_PENDING'
    throw err
  }

  const { data: request, error: insertError } = await supabase
    .from('school_change_requests')
    .insert({
      student_id: userId,
      requested_school_id: requestedSchoolId || null,
      requested_school_name: requestedSchoolId ? null : requestedSchoolName,
      proof_image_base64: proofImageBase64,
      status: 'pending',
    })
    .select('id, status, created_at')
    .single()
  if (insertError) throw insertError

  return { request }
}

export default createStudentHandler({ method: 'POST', validate, handle })
