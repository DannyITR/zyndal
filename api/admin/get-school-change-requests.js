import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'

async function handle() {
  const { data: requests, error: requestsError } = await supabase
    .from('school_change_requests')
    .select('id, student_id, requested_school_id, requested_school_name, proof_image_base64, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (requestsError) throw requestsError
  if (!requests || requests.length === 0) return { requests: [] }

  const studentIds = [...new Set(requests.map((r) => r.student_id))]
  const schoolIds = [...new Set(requests.map((r) => r.requested_school_id).filter(Boolean))]

  const [{ data: students, error: studentsError }, { data: schools, error: schoolsError }] = await Promise.all([
    supabase.from('users').select('id, username, display_name, email').in('id', studentIds),
    schoolIds.length ? supabase.from('schools').select('id, name').in('id', schoolIds) : Promise.resolve({ data: [] }),
  ])
  if (studentsError) throw studentsError
  if (schoolsError) throw schoolsError

  const studentById = Object.fromEntries((students || []).map((s) => [s.id, s]))
  const schoolById = Object.fromEntries((schools || []).map((s) => [s.id, s]))

  return {
    requests: requests.map((r) => {
      const student = studentById[r.student_id]
      const requestedSchoolName = r.requested_school_id ? schoolById[r.requested_school_id]?.name || 'Unknown' : r.requested_school_name
      return {
        id: r.id,
        studentUsername: student?.username || 'Unknown',
        studentDisplayName: student?.display_name || null,
        studentEmail: student?.email || null,
        requestedSchoolName,
        proofImageBase64: r.proof_image_base64,
        submittedAt: r.created_at,
      }
    }),
  }
}

export default createAdminHandler({ method: 'GET', handle })
