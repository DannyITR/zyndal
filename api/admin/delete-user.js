import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const userId = sanitizeUuid(body.user_id)
  if (!userId) return { field: 'user_id', message: 'A valid user_id is required.' }
  body.user_id = userId

  if (body.confirm !== 'DELETE') {
    return { field: 'confirm', message: 'Type DELETE to confirm.' }
  }
  return null
}

// Deletes every row across the schema that references this user, in an
// order that respects foreign-key dependencies, then the user row itself.
// Written explicitly rather than relying solely on each table's own ON
// DELETE CASCADE: notifications, email_verifications, password_reset_tokens,
// and push_subscriptions were all added via one-off SQL delivered straight
// to the operator (see supabase/schema.sql's own header — it was never kept
// in sync with those), so this can't assume their cascade behavior matches
// schema.sql's tables. Deleting rows that don't exist is always a safe
// no-op, so being explicit here can't do any harm either way.
async function hardDeleteUser(userId) {
  const { data: uploadRows, error: uploadsLookupError } = await supabase.from('uploads').select('id').eq('user_id', userId)
  if (uploadsLookupError) throw uploadsLookupError
  const uploadIds = (uploadRows || []).map((u) => u.id)
  if (uploadIds.length > 0) {
    const { error } = await supabase.from('upload_questions').delete().in('upload_id', uploadIds)
    if (error) throw error
  }

  const deletions = [
    ['grade_bonuses', (q) => q.or(`student_id.eq.${userId},parent_id.eq.${userId}`)],
    ['perfect_week_achievements', (q) => q.or(`student_id.eq.${userId},parent_id.eq.${userId}`)],
    ['payouts', (q) => q.or(`parent_id.eq.${userId},student_id.eq.${userId}`)],
    ['practice_sessions', (q) => q.eq('user_id', userId)],
    ['grades', (q) => q.eq('user_id', userId)],
    ['uploads', (q) => q.eq('user_id', userId)],
    ['study_plans', (q) => q.eq('user_id', userId)],
    ['streak_shares', (q) => q.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)],
    ['friends', (q) => q.or(`user_id.eq.${userId},friend_id.eq.${userId}`)],
    ['friend_requests', (q) => q.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)],
    ['parent_student', (q) => q.or(`parent_id.eq.${userId},student_id.eq.${userId}`)],
    ['streaks', (q) => q.eq('user_id', userId)],
    ['answers', (q) => q.eq('user_id', userId)],
    ['oauth_identities', (q) => q.eq('user_id', userId)],
    ['sessions', (q) => q.eq('user_id', userId)],
    ['notifications', (q) => q.eq('user_id', userId)],
    ['email_verifications', (q) => q.eq('user_id', userId)],
    ['password_reset_tokens', (q) => q.eq('user_id', userId)],
    ['push_subscriptions', (q) => q.eq('user_id', userId)],
  ]
  for (const [table, apply] of deletions) {
    const { error } = await apply(supabase.from(table).delete())
    if (error) throw error
  }

  const { error } = await supabase.from('users').delete().eq('id', userId)
  if (error) throw error
}

// Soft delete mirrors api/auth/delete-account.js exactly (same deleted_at +
// session-wipe + linked-students-coins-zeroed behavior), just targeting an
// admin-chosen user_id instead of the caller's own account.
async function softDeleteUser(userId, accountType) {
  const { error: deleteError } = await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', userId)
  if (deleteError) throw deleteError

  const { error: sessionError } = await supabase.from('sessions').delete().eq('user_id', userId)
  if (sessionError) throw sessionError

  if (accountType === 'parent' || accountType === 'teacher') {
    const { data: links, error: linksError } = await supabase.from('parent_student').select('student_id').eq('parent_id', userId)
    if (linksError) throw linksError
    const studentIds = (links || []).map((l) => l.student_id)
    if (studentIds.length > 0) {
      const { error: coinError } = await supabase.from('streaks').update({ coin_balance: 0 }).in('user_id', studentIds)
      if (coinError) throw coinError
    }
  }
}

async function handle({ body }) {
  const { data: user, error: userError } = await supabase.from('users').select('id, account_type').eq('id', body.user_id).maybeSingle()
  if (userError) throw userError
  if (!user) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  if (body.hard_delete) {
    await hardDeleteUser(body.user_id)
    return { success: true, hardDeleted: true }
  }

  await softDeleteUser(body.user_id, user.account_type)
  return { success: true, hardDeleted: false }
}

export default createAdminHandler({ method: 'POST', validate, handle })
