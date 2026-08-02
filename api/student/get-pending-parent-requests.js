import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Settings screen's "Pending parent requests" section — parent-initiated
// username-search requests only (see api/parent/link-request.js); email
// invites are resolved via the "Link to a Parent" code field instead (also
// in Settings), not shown as an approve/decline list here.
async function handle({ userId }) {
  const { data: invitations, error } = await supabase
    .from('parent_invitations')
    .select('id, parent_id, sent_at')
    .eq('student_id', userId)
    .eq('invite_type', 'username_search')
    .eq('status', 'pending')
    .order('sent_at', { ascending: false })
  if (error) throw error
  if (!invitations || invitations.length === 0) return { requests: [] }

  const parentIds = [...new Set(invitations.map((i) => i.parent_id))]
  const { data: parents, error: parentsError } = await supabase.from('users').select('id, username, avatar').in('id', parentIds)
  if (parentsError) throw parentsError
  const parentById = Object.fromEntries((parents || []).map((p) => [p.id, p]))

  return {
    requests: invitations.map((i) => ({
      id: i.id,
      parentUsername: parentById[i.parent_id]?.username || 'Unknown',
      parentAvatar: parentById[i.parent_id]?.avatar || null,
      sentAt: i.sent_at,
    })),
  }
}

export default createStudentHandler({ method: 'GET', handle })
