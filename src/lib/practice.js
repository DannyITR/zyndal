import { getUploadedQuestions } from './storage'
import { getBankForGrade, topicMatches } from './testPrepQuestionBank'

const SESSION_SIZE = 5

// Uploaded questions store correct_answer as text (and may have no options
// at all, for non-MCQ source documents) — only usable for a standard
// multiple-choice practice question if it has real options that include the
// answer.
function toUsablePracticeQuestion(uploaded) {
  if (!Array.isArray(uploaded.options) || uploaded.options.length < 2) return null
  const correct = uploaded.options.indexOf(uploaded.correct_answer)
  if (correct === -1) return null
  return {
    question: uploaded.question,
    options: uploaded.options,
    correct,
    explanation: uploaded.explanation || '',
    source: 'upload',
  }
}

function toDemoPracticeQuestion(bankQuestion) {
  return {
    question: bankQuestion.question,
    options: bankQuestion.options,
    correct: bankQuestion.correct,
    explanation: bankQuestion.explanation,
    source: 'bank',
  }
}

// Builds a 5-question practice set: the student's own uploaded questions on
// this subject/topic first, padded with the hardcoded demo bank (topic-matched
// where possible) up to 5. If 5+ usable uploaded questions exist, uploads
// alone fill the session.
export async function buildPracticeQuestions({ userId, subjectId, topic, grade }) {
  const uploaded = await getUploadedQuestions(userId, subjectId, topic)
  const usableUploaded = uploaded.map(toUsablePracticeQuestion).filter(Boolean).slice(0, SESSION_SIZE)

  const needed = SESSION_SIZE - usableUploaded.length
  if (needed <= 0) return usableUploaded

  // Topic-matched bank questions first, padded with the rest of that
  // subject/grade's bank if the topic match alone doesn't reach `needed`
  // (the bank only has 5 questions per subject/grade, so a narrow topic
  // match is common).
  const bank = getBankForGrade(subjectId, grade)
  const matched = bank.filter((q) => topicMatches(q.topic, topic))
  const rest = bank.filter((q) => !matched.includes(q))
  const pool = matched.length > 0 ? [...matched, ...rest] : bank
  const demo = pool.slice(0, needed).map(toDemoPracticeQuestion)

  return [...usableUploaded, ...demo]
}
