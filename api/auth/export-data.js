import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS, getStreakRow } from '../_lib/db.js'
import { getParentLinks, getStudentRows, getPayoutHistoryRows } from '../_lib/parentDb.js'

// Quebec Law 25 right-to-access/portability: everything this account's data
// covers, as one JSON download. profile already excludes password and
// deleted_at (SAFE_USER_COLUMNS never included either). "Uploads metadata"
// per spec means the uploads table rows themselves (subject, topic, grade,
// notes, summary...) — not the full extracted upload_questions bank, which
// is derived/regenerable content, not something-about-you in the Law 25
// sense.
//
// Sets Content-Disposition so a direct authenticated request (e.g. curl)
// downloads a named file — the browser UI can't rely on this alone, though,
// since fetch() with a custom X-Session-Token header never triggers a
// native browser download; see exportMyData()/handleExport in
// storage.js/SettingsScreen.jsx for how the client turns this response into
// an actual file save.
async function handle({ userId }) {
  const { data: profile, error: profileError } = await supabase.from('users').select(SAFE_USER_COLUMNS).eq('id', userId).maybeSingle()
  if (profileError) throw profileError
  if (!profile) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const exportedAt = new Date().toISOString()
  let payload

  if (profile.account_type === 'parent' || profile.account_type === 'teacher') {
    const [links, payoutHistory] = await Promise.all([getParentLinks(userId), getPayoutHistoryRows(userId)])
    const linkedStudents = await getStudentRows(links.map((l) => l.student_id))
    payload = {
      exported_at: exportedAt,
      account_type: profile.account_type,
      profile,
      linked_students: linkedStudents,
      payout_history: payoutHistory,
    }
  } else {
    const [streak, answers, grades, uploads, studyPlans, practiceSessions] = await Promise.all([
      getStreakRow(userId),
      supabase.from('answers').select('*').eq('user_id', userId).order('answered_at', { ascending: true }).then(unwrap),
      supabase.from('grades').select('*').eq('user_id', userId).order('test_date', { ascending: false }).then(unwrap),
      supabase.from('uploads').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(unwrap),
      supabase.from('study_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(unwrap),
      supabase.from('practice_sessions').select('*').eq('user_id', userId).order('completed_at', { ascending: false }).then(unwrap),
    ])
    payload = {
      exported_at: exportedAt,
      account_type: 'student',
      profile,
      streak,
      answers,
      grades,
      uploads,
      study_plans: studyPlans,
      practice_sessions: practiceSessions,
    }
  }

  return payload
}

function unwrap({ data, error }) {
  if (error) throw error
  return data || []
}

export default createStudentHandler({ method: 'GET', handle, downloadFilename: 'zyndal-my-data.json' })
