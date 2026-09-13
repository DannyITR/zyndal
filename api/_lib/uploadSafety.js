import { generateJson } from './anthropic.js'

// Narrowly scoped and biased toward flagging when in doubt — same
// philosophy as api/_lib/messageSafety.js, adapted for images/PDFs a
// student wants to share with their whole unclaimed-group study calendar
// instead of keeping private. Unlike messageSafety.js (which screens
// AFTER sending, async, and only ever adds an admin-review row), this one
// runs synchronously and BLOCKS the save entirely when flagged — see
// api/uploads/save-shared-upload.js, the only caller.
const UPLOAD_SAFETY_SYSTEM_PROMPT = `You are a content safety screener for a Quebec high school study app. A student has photographed or scanned page(s) of notes/homework/study material to share with their classmates in a shared group study calendar, so classmates who missed a day can see them. Screen the image(s)/document for content that would be INAPPROPRIATE to share with an entire class of teenage students:

1. Explicit sexual content or nudity
2. Graphic violence, gore, or disturbing imagery
3. Hate speech, discriminatory symbols, or slurs
4. Content promoting self-harm, drugs, weapons, or illegal activity
5. Content that is clearly NOT school-related material (e.g. random personal photos, memes, screenshots of private conversations) and would be out of place shared with a whole class

Do NOT flag legitimate school notes, homework, worksheets, or textbook pages just because the handwriting is messy, the photo is blurry or poorly lit, or the material covers a sensitive-but-legitimate academic topic (e.g. the history of war, human biology, historical atrocities discussed in a textbook). Only flag genuinely inappropriate content as described above — when in doubt about a clean academic document, do not flag it.

Return only JSON: { flagged: boolean, reason: string (one short, student-friendly sentence explaining why if flagged, empty string otherwise) }`

const UPLOAD_SAFETY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    flagged: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['flagged', 'reason'],
}

// files: the same [{ base64, mediaType }] shape api/generate-from-document.js
// already validates/consumes — reused here as-is so the client can pass the
// exact encoded images it already produced for extraction (see
// processUploadedDocument's encodedFiles in src/lib/ai.js) without
// re-encoding them a second time.
export async function screenUploadImages(files) {
  const documentBlocks = files.map((file) =>
    file.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.base64 } }
      : { type: 'image', source: { type: 'base64', media_type: file.mediaType, data: file.base64 } }
  )

  return generateJson({
    system: UPLOAD_SAFETY_SYSTEM_PROMPT,
    schema: UPLOAD_SAFETY_SCHEMA,
    maxTokens: 300,
    content: [...documentBlocks, { type: 'text', text: 'Screen this content now.' }],
  })
}
