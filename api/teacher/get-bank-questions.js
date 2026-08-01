import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeSubject, sanitizeGrade, sanitizeInteger } from '../_lib/sanitize.js'
import { getScheduledUnits } from '../_lib/dailyQuestion.js'
import { DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

function validate(body) {
  const subject = sanitizeSubject(body.subject)
  if (!subject) return { field: 'subject', message: 'A valid subject is required.' }
  body.subject = subject

  const grade = sanitizeGrade(body.grade)
  if (!grade) return { field: 'grade', message: 'Grade must be between 7 and 11.' }
  body.grade = grade

  if (body.random_count !== undefined && body.random_count !== '') {
    const count = sanitizeInteger(body.random_count, 1, 50)
    if (count === null) return { field: 'random_count', message: 'random_count must be a whole number between 1 and 50.' }
    body.random_count = count
  } else {
    body.random_count = null
  }

  return null
}

async function handle({ body }) {
  // "Add random questions" scopes to whatever unit(s) the seasonal
  // schedule currently points at for this subject/grade — the same
  // resolution the daily question itself uses (see
  // api/_lib/dailyQuestion.js) — so a teacher's random pick lines up with
  // what students are actually seeing this month. A plain browse (no
  // random_count) doesn't apply that filter, since a teacher deliberately
  // looking through the bank likely wants to see everything available.
  if (body.random_count) {
    let scheduledUnits = []
    try {
      scheduledUnits = await getScheduledUnits(body.subject, body.grade, DEFAULT_TIMEZONE)
    } catch (err) {
      console.error('[teacher] failed to resolve scheduled units for random questions:', err)
    }
    const unitNumbers = scheduledUnits.map((u) => u.unit_number)

    let query = supabase.from('generated_questions').select('*').eq('subject', body.subject).eq('grade', body.grade)
    if (unitNumbers.length > 0) query = query.in('unit_number', unitNumbers)
    const { data, error } = await query
    if (error) throw error

    const pool = data || []
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return { questions: shuffled.slice(0, body.random_count) }
  }

  const { data, error } = await supabase
    .from('generated_questions')
    .select('*')
    .eq('subject', body.subject)
    .eq('grade', body.grade)
    .order('unit_number', { ascending: true })
  if (error) throw error
  return { questions: data || [] }
}

export default createTeacherHandler({ method: 'GET', validate, handle })
