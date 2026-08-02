import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeEmail } from '../_lib/sanitize.js'
import { sendParentInviteEmail } from '../_lib/resend.js'

function validate(body) {
  const email = sanitizeEmail(body.child_email)
  if (!email) return { field: 'child_email', message: 'A valid email address is required.' }
  body.child_email = email
  return null
}

// "Add Child" Option B — no student account needs to exist yet. The
// invitation row (status stays 'pending' until link-parent.js's
// same-parent-code path marks it accepted once the child actually signs up
// or links, since api/auth/signup.js itself is off-limits to changes and
// can't do that marking directly — see link-parent.js's own comment).
async function handle({ parentId, body }) {
  const { data: parent, error: parentError } = await supabase
    .from('users')
    .select('username, display_name, parent_code, language_preference')
    .eq('id', parentId)
    .maybeSingle()
  if (parentError) throw parentError

  const { data: existingInvite, error: existingInviteError } = await supabase
    .from('parent_invitations')
    .select('id')
    .eq('parent_id', parentId)
    .eq('child_email', body.child_email)
    .eq('status', 'pending')
    .maybeSingle()
  if (existingInviteError) throw existingInviteError
  if (existingInvite) {
    const err = new Error("You've already invited this email — ask them to check their inbox.")
    err.status = 400
    err.code = 'ALREADY_PENDING'
    throw err
  }

  // Sent before the row is inserted, not after — a failed send must never
  // leave a "Pending" badge on the parent's dashboard for an invite the
  // child never actually received.
  await sendParentInviteEmail({
    email: body.child_email,
    parentName: parent.display_name || parent.username,
    parentCode: parent.parent_code,
    languagePreference: parent.language_preference,
  })

  const { data: invitation, error: insertError } = await supabase
    .from('parent_invitations')
    .insert({
      parent_id: parentId,
      child_email: body.child_email,
      parent_code: parent.parent_code,
      invite_type: 'email',
      status: 'pending',
    })
    .select()
    .single()
  if (insertError) throw insertError

  return { invitation }
}

export default createParentHandler({ method: 'POST', validate, handle })
