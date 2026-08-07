import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Settings screen's read-only "Linked Parents" section — up to 2 linked
// parents per student (see api/_lib/parentDb.js's countParentLinksForStudent).
// Nothing here lets the student unlink; that's deliberate.
async function handle({ userId }) {
  const { data: links, error } = await supabase.from('parent_student').select('parent_id').eq('student_id', userId)
  if (error) throw error
  if (!links || links.length === 0) return { parents: [] }

  const parentIds = links.map((l) => l.parent_id)
  const { data: parents, error: parentsError } = await supabase.from('users').select('id, username, avatar').in('id', parentIds)
  if (parentsError) throw parentsError

  return { parents: (parents || []).map((p) => ({ id: p.id, username: p.username, avatar: p.avatar })) }
}

export default createStudentHandler({ method: 'GET', handle })
