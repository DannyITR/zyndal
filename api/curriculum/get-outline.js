import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { generateCurriculumOutlineData } from '../generate-curriculum.js'
import { SUBJECTS } from '../../src/lib/questions.js'

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

async function handle({ body }) {
  const subject = body.subject
  const grade = Number(body.grade)

  const { data: existing, error } = await supabase
    .from('curriculum_outlines')
    .select('*')
    .eq('subject', subject)
    .eq('grade', grade)
    .maybeSingle()
  if (error) throw error
  if (existing) return existing

  const subjectName = SUBJECTS.find((s) => s.id === subject)?.name || subject
  const outlineData = await generateCurriculumOutlineData(subjectName, grade)

  const { data: saved, error: saveError } = await supabase
    .from('curriculum_outlines')
    .insert({ subject, grade, outline_data: outlineData })
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
        .maybeSingle()
      if (refetchError) throw refetchError
      if (winner) return winner
    }
    throw saveError
  }
  return saved
}

export default createStudentHandler({ method: 'GET', validate, handle })
