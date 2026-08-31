import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'

async function handle() {
  const { data: claims, error: claimsError } = await supabase
    .from('teacher_claims')
    .select('id, teacher_id, group_id, course_number, bio_link, display_name, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (claimsError) throw claimsError
  if (!claims || claims.length === 0) return { claims: [] }

  const teacherIds = [...new Set(claims.map((c) => c.teacher_id))]
  const groupIds = [...new Set(claims.map((c) => c.group_id))]

  const [{ data: teachers, error: teachersError }, { data: groups, error: groupsError }] = await Promise.all([
    supabase.from('users').select('id, username, display_name, email').in('id', teacherIds),
    supabase.from('school_subject_groups').select('id, school_id, subject, grade').in('id', groupIds),
  ])
  if (teachersError) throw teachersError
  if (groupsError) throw groupsError

  const schoolIds = [...new Set((groups || []).map((g) => g.school_id))]
  const { data: schools, error: schoolsError } = schoolIds.length
    ? await supabase.from('schools').select('id, name').in('id', schoolIds)
    : { data: [] }
  if (schoolsError) throw schoolsError

  const teacherById = Object.fromEntries((teachers || []).map((t) => [t.id, t]))
  const schoolById = Object.fromEntries((schools || []).map((s) => [s.id, s]))
  const groupById = Object.fromEntries((groups || []).map((g) => [g.id, g]))

  return {
    claims: claims.map((c) => {
      const teacher = teacherById[c.teacher_id]
      const group = groupById[c.group_id]
      const school = group ? schoolById[group.school_id] : null
      return {
        id: c.id,
        teacherUsername: teacher?.username || 'Unknown',
        teacherDisplayName: teacher?.display_name || null,
        teacherEmail: teacher?.email || null,
        schoolName: school?.name || 'Unknown',
        subject: group?.subject || null,
        grade: group?.grade ?? null,
        courseNumber: c.course_number,
        bioLink: c.bio_link,
        displayName: c.display_name,
        submittedAt: c.created_at,
      }
    }),
  }
}

export default createAdminHandler({ method: 'GET', handle })
