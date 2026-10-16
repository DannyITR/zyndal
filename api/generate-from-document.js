import { createStudentHandler } from './_lib/studentHandler.js'
// Upload paths are no longer premium-gated (all features unlocked) —
// commented out, not deleted, so it can be re-enabled.
// import { assertPremium } from './_lib/subscription.js'
import { extractDocument } from './_lib/documentExtraction.js'

// Mirrors processUploadedDocument in src/lib/ai.js — NOT one of the four
// endpoints originally requested, but added to close the same gap: this is
// the last Claude call that was still using the browser-exposed key (photo/
// PDF uploads are scanned here). Leaving it out would defeat the point of
// this migration, since an attacker could still pull the key from this
// call path. See src/lib/imageUtils.js for the client-side resize/encode
// step this depends on.
//
// Caveat: Vercel's standard Node.js functions cap request bodies around
// 4.5MB. A photo is downscaled+JPEG-compressed client-side before it gets
// here, and for a multi-page upload the client steps the photos'
// quality down further until the whole request fits (see
// encodeFilesWithinBudget in src/lib/imageUtils.js). An uncompressed PDF up
// to the client's 15MB cap can't be shrunk that way, so the client refuses
// to send a set that would still exceed the cap rather than letting Vercel
// reject it before this handler even runs.

// Upload limits removed (no page cap for any user) — commented out, not
// deleted, so it can be re-enabled. See save-shared-upload.js.
// const MAX_PAGES = 10

function validate(body) {
  if (!body.uploadType || !['test', 'study_material'].includes(body.uploadType)) return 'uploadType must be "test" or "study_material".'
  if (!Array.isArray(body.files) || body.files.length === 0) return 'files must be a non-empty array.'
  // if (body.files.length > MAX_PAGES) return `files cannot exceed ${MAX_PAGES} pages.`
  for (const file of body.files) {
    if (!file || typeof file.base64 !== 'string' || !file.base64) return 'each file must include base64 data.'
    if (!file.mediaType || typeof file.mediaType !== 'string') return 'each file must include a mediaType.'
  }
  return null
}

// See generate-study-guide.js's identical comment for why this moved from
// createGenerateHandler (no auth) to createStudentHandler + assertPremium
// — this one in particular used to mean anyone, logged in or not, could
// upload arbitrary images/PDFs and have them scanned on Zyndal's dime.
async function handle({ userId, body }) {
  // await assertPremium(userId)
  // Batched, merged and de-duplicated in api/_lib/documentExtraction.js.
  return extractDocument({ uploadType: body.uploadType, files: body.files })
}

export default createStudentHandler({ method: 'POST', validate, handle })
