import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'

function validate(body) {
  if (!body.parent_code || typeof body.parent_code !== 'string' || !body.parent_code.trim()) {
    return { field: 'parent_code', message: 'Parent code is required.' }
  }
  body.parent_code = body.parent_code.trim().toUpperCase()
  return null
}

// Covers three entry points with one endpoint: the student's own "Link to
// a Parent" field in Settings, a student clicking the "Settings → Join a
// Parent" fallback text in the invite email, AND — called automatically by
// SignupForm.jsx right after a parent-code signup succeeds — the
// notification/invitation side effects for signup.js's own immediate
// parent_student insert. signup.js itself is off-limits to changes (see
// its own header comment / db.js), so it can't send the "student linked"
// notification or mark a matching email invitation accepted itself; this
// endpoint does both, and is written to be a no-op-safe idempotent second
// call when the link already exists from signup.js's insert.
async function handle({ userId, body }) {
  const { data: parent, error: parentError } = await supabase
    .from('users')
    .select('id, username')
    .eq('parent_code', body.parent_code)
    .eq('account_type', 'parent')
    .is('deleted_at', null)
    .maybeSingle()
  if (parentError) throw parentError
  if (!parent) {
    const err = new Error('That parent code was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: existingLink, error: existingLinkError } = await supabase
    .from('parent_student')
    .select('parent_id')
    .eq('student_id', userId)
    .maybeSingle()
  if (existingLinkError) throw existingLinkError

  if (existingLink && existingLink.parent_id !== parent.id) {
    const err = new Error("You're already linked to a parent.")
    err.status = 400
    err.code = 'ALREADY_LINKED'
    throw err
  }

  if (!existingLink) {
    const { error: insertError } = await supabase.from('parent_student').insert({ parent_id: parent.id, student_id: userId })
    if (insertError) throw insertError
  }

  const { data: student } = await supabase.from('users').select('username, email').eq('id', userId).maybeSingle()

  // Only 'email'/'code' invitations get auto-marked here — a
  // 'username_search' request is resolved through its own accept/decline
  // flow (api/student/respond-parent-link.js), which already has the exact
  // invitation_id in hand and shouldn't be short-circuited by a plain code
  // entry that happens to reach the same parent. Two separate queries (by
  // student_id, by child_email) instead of one .or() string — keeps a
  // user-controlled email value out of a hand-built PostgREST filter
  // expression entirely.
  const baseInviteQuery = () =>
    supabase.from('parent_invitations').select('id').eq('parent_id', parent.id).eq('status', 'pending').in('invite_type', ['email', 'code'])
  const [byStudentId, byEmail] = await Promise.all([
    baseInviteQuery().eq('student_id', userId),
    student?.email ? baseInviteQuery().ilike('child_email', student.email) : Promise.resolve({ data: [] }),
  ])
  if (byStudentId.error) throw byStudentId.error
  if (byEmail.error) throw byEmail.error
  const matchingInviteIds = [...new Set([...(byStudentId.data || []), ...(byEmail.data || [])].map((i) => i.id))]
  if (matchingInviteIds.length > 0) {
    await supabase
      .from('parent_invitations')
      .update({ status: 'accepted', student_id: userId, accepted_at: new Date().toISOString() })
      .in('id', matchingInviteIds)
  }

  const title = `✅ @${student?.username || 'A student'} is now linked to your account`
  await insertNotification({
    userId: parent.id,
    type: 'parent_link_accepted',
    title,
    body: 'You can now see their progress on your dashboard.',
    data: { student_id: userId, student_username: student?.username },
  })
  await sendPushToUser({
    userId: parent.id,
    type: 'parent_link_accepted',
    title,
    body: 'You can now see their progress on your dashboard.',
    url: 'https://zyndal.ca',
  })

  return { parent: { id: parent.id, username: parent.username } }
}

export default createStudentHandler({ method: 'POST', validate, handle })
