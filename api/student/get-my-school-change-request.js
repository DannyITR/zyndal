import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// The student's single most-recent school-change request, whatever its
// status — SettingsScreen.jsx decides what to show from that (pending
// blocks resubmission; approved is stale the moment users.school_id already
// reflects it, so the client treats it the same as "no request").
async function handle({ userId }) {
  const { data: request, error } = await supabase
    .from('school_change_requests')
    .select('id, requested_school_id, requested_school_name, status, rejection_reason, created_at')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!request) return { request: null }

  let requestedSchoolName = request.requested_school_name
  if (request.requested_school_id) {
    const { data: school } = await supabase.from('schools').select('name').eq('id', request.requested_school_id).maybeSingle()
    requestedSchoolName = school?.name ?? requestedSchoolName
  }

  return {
    request: {
      status: request.status,
      rejectionReason: request.rejection_reason,
      requestedSchoolName,
      createdAt: request.created_at,
    },
  }
}

export default createStudentHandler({ method: 'GET', handle })
