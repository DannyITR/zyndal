import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { generateCurriculumOutlineData } from '../generate-curriculum.js'
import { SUBJECTS } from '../../src/lib/questions.js'
import { LANG_FOR_PREFERENCE } from '../_lib/notificationText.js'

// Consolidates CurriculumOutlineScreen's three-step client orchestration
// (check curriculum_outlines -> call /api/generate-curriculum -> save the
// result) into one server-side call, as spec'd. curriculum_outlines is a
// shared global cache (no user_id — see schema.sql), so this never needs
// per-user scoping beyond the session-auth check itself.
function validate(body) {
  if (!body.subject || !SUBJECTS.some((s) => s.id === body.subject)) return 'subject is invalid.'
  const grade = Number(body.grade)
  if (!Number.isFinite(grade)) return 'grade is required and must be a number.'
  return null
}

async function handle({ userId, body }) {
  const subject = body.subject
  const grade = Number(body.grade)

  const { data: user, error: userError } = await supabase.from('users').select('language_preference').eq('id', userId).maybeSingle()
  if (userError) throw userError
  const language = LANG_FOR_PREFERENCE[user?.language_preference] || 'en'

  const { data: existing, error } = await supabase
    .from('curriculum_outlines')
    .select('*')
    .eq('subject', subject)
    .eq('grade', grade)
    .eq('language', language)
    .maybeSingle()
  if (error) throw error
  if (existing) return existing

  // The student's language outline may not have been translated yet — fall
  // back to English (see scripts/generate-multilingual-content.js for how
  // fr/es outlines actually get populated) rather than regenerating a
  // duplicate English outline the app already has.
  if (language !== 'en') {
    const { data: englishExisting, error: englishError } = await supabase
      .from('curriculum_outlines')
      .select('*')
      .eq('subject', subject)
      .eq('grade', grade)
      .eq('language', 'en')
      .maybeSingle()
    if (englishError) throw englishError
    if (englishExisting) return englishExisting
  }

  // Neither the student's language nor English exists yet — bootstrap the
  // canonical English outline. Translating it to fr/es is the separate bulk
  // script/admin endpoint's job, not this on-demand path's.
  const subjectName = SUBJECTS.find((s) => s.id === subject)?.name || subject
  const outlineData = await generateCurriculumOutlineData(subjectName, grade)

  const { data: saved, error: saveError } = await supabase
    .from('curriculum_outlines')
    .insert({ subject, grade, outline_data: outlineData, language: 'en' })
    .select()
    .single()
  if (saveError) {
    if (saveError.code === '23505') {
      // Another request generated and saved this exact subject+grade first
      // — read back the winner's row instead of erroring.
      const { data: winner, error: refetchError } = await supabase
        .from('curriculum_outlines')
        .select('*')
        .eq('subject', subject)
        .eq('grade', grade)
        .eq('language', 'en')
        .maybeSingle()
      if (refetchError) throw refetchError
      if (winner) return winner
    }
    throw saveError
  }
  return saved
}

export default createStudentHandler({ method: 'GET', validate, handle })
