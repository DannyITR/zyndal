// Domain logic for the "where should your practice questions come from?"
// step shared by Test Prep and Study Guide: the three source options, the
// localStorage preference, resolving an upload's questions (pre-extracted
// or generated on the fly), and the client-side merging that keeps them
// verbatim rather than trusting the model not to paraphrase them.

import { getUploadedContentForSubject, cacheGeneratedUploadQuestions } from './storage'
import { generateQuestionsFromUploadContent } from './ai'

const SOURCE_META = {
  uploads: { icon: '📁', label: 'From your uploaded materials' },
  ai: { icon: '🤖', label: 'AI generated from Quebec curriculum' },
  mix: { icon: '🔀', label: 'Best of both — your uploads + curriculum questions' },
}

// An upload is usable as a question source if it already has multiple-choice
// questions extracted, or has a summary we can generate questions from on
// the fly (see resolveUploadQuestionPool) — an upload with neither (e.g. a
// failed scan) doesn't count.
export function countUsableUploads(content) {
  return content.filter((upload) => upload.usableQuestions.length > 0 || upload.summary).length
}

// Builds the list of selectable cards for a subject. Uploads-based options
// only appear once the student has at least one usable upload for that
// subject; otherwise AI generation is the only choice.
export function getSourceOptions(uploadCount, subjectName) {
  if (uploadCount <= 0) {
    return [{ id: 'ai', ...SOURCE_META.ai, sublabel: 'Fresh questions every time' }]
  }
  return [
    { id: 'uploads', ...SOURCE_META.uploads, sublabel: `${uploadCount} upload${uploadCount === 1 ? '' : 's'} available for ${subjectName}` },
    { id: 'ai', ...SOURCE_META.ai, sublabel: 'Fresh questions every time' },
    { id: 'mix', ...SOURCE_META.mix, sublabel: 'Combines your materials with AI questions' },
  ]
}

// The hint shown under a single-option (AI-only) picker. Distinguishes "you
// haven't uploaded anything for this subject" from the rarer case where
// uploads exist but none had enough content to build questions from (no
// multiple-choice questions and no summary — see countUsableUploads).
export function getNoOptionsHint(hasAnyUploads) {
  return hasAnyUploads
    ? "You've uploaded materials for this subject, but there wasn't enough content to build questions from yet — upload a test or worksheet to unlock more options."
    : 'Upload your class materials to unlock more options.'
}

function prefKey(subjectId) {
  return `zyndal_question_source_${subjectId}`
}

export function getSourcePreference(subjectId) {
  try {
    return localStorage.getItem(prefKey(subjectId))
  } catch {
    return null
  }
}

export function saveSourcePreference(subjectId, source) {
  try {
    localStorage.setItem(prefKey(subjectId), source)
  } catch {
    // Best-effort — worst case the picker just isn't pre-selected next time.
  }
}

// ---------- Resolving an upload's questions ----------
// For each of the student's uploads for this subject, in order: use its
// pre-extracted multiple-choice questions if it has any; otherwise generate
// 5 from its summary/key_concepts via Claude and cache them into
// upload_questions so this upload never needs generating again; otherwise
// (no summary either) skip it — there's nothing to build questions from.
export async function resolveUploadQuestionPool(userId, subject, subjectName, grade, onStatusChange) {
  const content = await getUploadedContentForSubject(userId, subject)
  const pool = []

  for (const upload of content) {
    if (upload.usableQuestions.length > 0) {
      pool.push(...upload.usableQuestions)
      continue
    }
    if (upload.summary) {
      onStatusChange?.('Generating questions from your uploaded materials…')
      const generated = await generateQuestionsFromUploadContent({
        summary: upload.summary,
        keyConcepts: upload.keyConcepts,
        subject: subjectName,
        grade,
      })
      await cacheGeneratedUploadQuestions(upload.uploadId, generated.questions)
      pool.push(...generated.questions)
      continue
    }
    // Insufficient content (no extracted questions, no summary) — skip this upload.
  }

  return pool
}

// ---------- Uploads-only (no API call once the pool above is resolved) ----------

export function buildGuideFromUploads(uploadedQuestions, subjectName, count = 5) {
  return {
    topic: `Your ${subjectName} uploads`,
    questions: uploadedQuestions.slice(0, count),
  }
}

function splitSequential(arr, parts) {
  const chunkSize = Math.ceil(arr.length / parts)
  const chunks = []
  for (let i = 0; i < parts; i++) chunks.push(arr.slice(i * chunkSize, (i + 1) * chunkSize))
  return chunks
}

export function buildPlanDaysFromUploads(uploadedQuestions, daysAvailable, topic) {
  const dayCount = Math.max(1, Math.min(daysAvailable, uploadedQuestions.length))
  const chunks = splitSequential(uploadedQuestions, dayCount)
  return chunks.map((chunk, i) => ({
    day: i + 1,
    title: `Day ${i + 1}: ${topic}`,
    focus: 'Review your uploaded questions',
    lesson: 'These questions come straight from what you uploaded — work through them and check the explanation on any you miss.',
    questions: chunk,
  }))
}

// ---------- Mix (uploads first, AI fills the gap) ----------
// Consumes uploaded questions in order across days/guide so none repeat.

export function mixGuideQuestions(uploadedQuestions, aiGuide, count = 5) {
  const take = Math.min(uploadedQuestions.length, count)
  const fromUploads = uploadedQuestions.slice(0, take)
  const fromAi = aiGuide.questions.slice(0, count - take)
  return {
    topic: take > 0 ? `Mixed: your uploads + ${aiGuide.topic}` : aiGuide.topic,
    questions: [...fromUploads, ...fromAi],
  }
}

export function mixPlanDays(uploadedQuestions, aiDays) {
  const pool = [...uploadedQuestions]
  return aiDays.map((day) => {
    const take = Math.min(pool.length, day.questions.length)
    const fromUploads = pool.splice(0, take)
    const fromAi = day.questions.slice(take)
    return { ...day, questions: [...fromUploads, ...fromAi] }
  })
}
