// Pure domain logic for the "where should your practice questions come
// from?" step shared by Test Prep and Study Guide: the three source
// options, the localStorage preference, and the client-side merging that
// keeps uploaded questions verbatim rather than trusting the model to not
// paraphrase them.

const SOURCE_META = {
  uploads: { icon: '📁', label: 'From your uploaded materials' },
  ai: { icon: '🤖', label: 'AI generated from Quebec curriculum' },
  mix: { icon: '🔀', label: 'Best of both — your uploads + curriculum questions' },
}

// Builds the list of selectable cards for a subject. Uploads-based options
// only appear once the student actually has extracted questions for that
// subject; otherwise AI generation is the only choice.
export function getSourceOptions(uploadCount, subjectName) {
  if (uploadCount <= 0) {
    return [{ id: 'ai', ...SOURCE_META.ai, sublabel: 'Fresh questions every time' }]
  }
  return [
    { id: 'uploads', ...SOURCE_META.uploads, sublabel: `${uploadCount} question${uploadCount === 1 ? '' : 's'} available for ${subjectName}` },
    { id: 'ai', ...SOURCE_META.ai, sublabel: 'Fresh questions every time' },
    { id: 'mix', ...SOURCE_META.mix, sublabel: 'Combines your materials with AI questions' },
  ]
}

// The hint shown under a single-option (AI-only) picker. Distinguishes "you
// haven't uploaded anything for this subject" from the more confusing case
// where uploads exist but none of them extracted as multiple-choice
// questions (open-ended worksheets/notes) — see getUploadedQuestionsForSubject
// in storage.js, which only surfaces questions it can actually quiz on.
export function getNoOptionsHint(hasAnyUploads) {
  return hasAnyUploads
    ? "You've uploaded materials for this subject, but none had multiple-choice questions we could pull from yet — upload a test or worksheet with multiple-choice questions to unlock more options."
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

// ---------- Uploads-only (no API call) ----------

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
