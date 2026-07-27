import { SUBJECTS } from './questions'
import { buildDemoStudyPlanDays, buildDemoStudyGuide } from './testPrepQuestionBank'
import { fileToBase64, resizeImageToBase64 } from './imageUtils'

// ⚠️ TEMPORARY TESTING SWITCH — while true, generateStudyPlan and
// generateStudyGuide return hardcoded questions from testPrepQuestionBank.js
// instead of calling the API. Set back to false (and nothing else needs to
// change) to restore live AI generation.
const DEMO_MODE = true

function resolveSubjectId(nameOrId) {
  const byId = SUBJECTS.find((s) => s.id === nameOrId)
  if (byId) return byId.id
  const byName = SUBJECTS.find((s) => s.name.toLowerCase() === String(nameOrId).toLowerCase())
  return byName ? byName.id : nameOrId
}

// Every Claude call now goes through a Vercel serverless function under
// /api instead of the Anthropic SDK running in the browser — the API key
// lives only in that function's server-side environment (ANTHROPIC_API_KEY,
// no VITE_ prefix), never in the client bundle. See api/_lib/anthropic.js
// for the shared model/schema/prompt-running logic and api/generate-*.js
// for each endpoint. Locally this requires `vercel dev` (not just
// `vite dev`) so /api routes actually exist to call.
async function callGenerateApi(endpoint, body) {
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || `Request to ${endpoint} failed (${response.status}).`)
  }
  return data
}

// Pure AI generation, curriculum-aligned only — the student's own uploaded
// questions (if they chose that source, or "mix") are merged in
// client-side afterward by questionSource.js, which keeps them verbatim
// instead of trusting the model not to paraphrase them.
export async function generateStudyPlan({ grade, subject, topic, daysAvailable, language = 'English' }) {
  if (DEMO_MODE) {
    return buildDemoStudyPlanDays({ subjectId: resolveSubjectId(subject), grade, topic, daysAvailable })
  }
  return callGenerateApi('generate-test-prep', { subject, grade, topic, days_available: daysAvailable, language })
}

// Daily fallback study guide: 5 questions for the student's grade on a
// subject that rotates deterministically per day.
export function getTodaysGuideSubject(date = new Date()) {
  const daysSinceEpoch = Math.floor(date.getTime() / 86400000)
  return SUBJECTS[daysSinceEpoch % SUBJECTS.length]
}

export async function generateStudyGuide({ grade, subjectName, language = 'English' }) {
  if (DEMO_MODE) {
    return buildDemoStudyGuide({ subjectId: resolveSubjectId(subjectName), grade })
  }
  return callGenerateApi('generate-study-guide', { subject: subjectName, grade, language })
}

// language: the language detected from this upload's own summary/key_concepts
// (see detectLanguageFromContent in languageDetection.js, computed by the
// caller in questionSource.js) — not the student's profile preference,
// since the point is to match whatever language THIS material is in.
export async function generateQuestionsFromUploadContent({ summary, keyConcepts, subject, grade, language = 'English' }) {
  return callGenerateApi('generate-from-upload', { subject, grade, summary, key_concepts: keyConcepts, language })
}

// Not gated by DEMO_MODE — unlike study plans/guides (generated repeatedly,
// per student, per session), an outline is generated at most once per
// subject+grade combination ever and then shared by every student from
// Supabase forever (see getCurriculumOutline/saveCurriculumOutline in
// storage.js), so the real-world call volume is already tiny (≤18 calls:
// 6 subjects × 3 grades) regardless of how many students use the app.
export async function generateCurriculumOutline({ grade, subjectName }) {
  return callGenerateApi('generate-curriculum', { subject: subjectName, grade })
}

// Not gated by DEMO_MODE — there's no meaningful hardcoded stand-in for
// "read the content of this specific photo", so this always calls the API.
// uploadType: 'test' | 'study_material' — only used to phrase the prompt
// ("a test" vs "a study material"); the model's own document_type
// classification (test/worksheet/textbook/notes) is what gets returned.
// files: 1-5 File objects (images and/or PDFs), all pages of one document,
// sent together so the model can extract questions spanning multiple pages
// without duplication.
export async function processUploadedDocument({ files, uploadType }) {
  const encodedFiles = await Promise.all(
    files.map(async (file) => {
      const isPdf = file.type === 'application/pdf'
      const { base64, mediaType } = isPdf ? await fileToBase64(file) : await resizeImageToBase64(file)
      return { base64, mediaType }
    })
  )

  return callGenerateApi('generate-from-document', { uploadType, files: encodedFiles })
}
