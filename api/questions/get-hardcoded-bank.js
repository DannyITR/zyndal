import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SUBJECTS } from '../../src/lib/questions.js'
import { getBankForGrade } from '../../src/lib/testPrepQuestionBank.js'

// Exposes the hardcoded question bank (src/lib/testPrepQuestionBank.js —
// the DEMO_MODE stand-in for live AI generation) as an endpoint, as
// requested. Not currently wired into a fallback path: today, if a live
// Claude call in ai.js fails, Study Guide/Test Prep just show an error —
// there's no existing "fall back to the hardcoded bank" behavior to migrate.
// Wiring that up would be new fallback UI logic, not a serverless-migration
// change, so it's left for whoever builds that feature to call this.
async function handle({ userId }) {
  const { data: user, error } = await supabase.from('users').select('grade').eq('id', userId).maybeSingle()
  if (error) throw error
  const grade = user?.grade || 9

  const bank = {}
  for (const subject of SUBJECTS) {
    bank[subject.id] = getBankForGrade(subject.id, grade)
  }

  return { grade, bank }
}

export default createStudentHandler({ method: 'GET', handle })
