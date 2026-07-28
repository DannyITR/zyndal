import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Quebec Law 25 right-to-deletion: soft delete only — sets deleted_at and
// (for a parent) zeroes their linked students' coin balances, but doesn't
// touch anything else. Data is retained 90 days for restoration (email
// hello@zyndal.com) before a manual permanent purge — see
// supabase/schema.sql's deleted_at column comment. Lives under api/auth/
// (matching the requested path) but, unlike login/signup/logout, this
// requires a real authenticated session — createStudentHandler, not
// createPublicHandler — since it's a destructive action on the caller's own
// account, not a pre-session operation.
function validate(body) {
  if (body.confirmation !== 'DELETE') {
    return { field: 'confirmation', message: 'Type DELETE to confirm.' }
  }
  return null
}

async function handle({ userId }) {
  const { data: user, error: userError } = await supabase.from('users').select('account_type').eq('id', userId).maybeSingle()
  if (userError) throw userError
  if (!user) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { error: deleteError } = await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', userId)
  if (deleteError) throw deleteError

  // Every device this account was signed in on is logged out immediately —
  // not just the one making this request.
  const { error: sessionError } = await supabase.from('sessions').delete().eq('user_id', userId)
  if (sessionError) throw sessionError

  if (user.account_type === 'parent') {
    const { data: links, error: linksError } = await supabase.from('parent_student').select('student_id').eq('parent_id', userId)
    if (linksError) throw linksError
    const studentIds = (links || []).map((l) => l.student_id)
    if (studentIds.length > 0) {
      const { error: coinError } = await supabase.from('streaks').update({ coin_balance: 0 }).in('user_id', studentIds)
      if (coinError) throw coinError
    }
  }

  return { success: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
