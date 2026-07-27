import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Backs updateUserProfile() in src/lib/storage.js. grade and
// language_preference are only meaningful for students, but this endpoint
// (like updateUserProfile itself) doesn't need to branch on account_type —
// the caller (SettingsScreen.jsx) already only sends them for students.
function validate(body) {
  if (body.grade !== undefined && body.grade !== null && !Number.isFinite(body.grade)) return 'grade must be a number if provided.'
  return null
}

async function handle({ userId, body }) {
  const { display_name, email, school, avatar, grade, language_preference } = body
  const { data, error } = await supabase
    .from('users')
    .update({
      display_name: display_name || null,
      email: email || null,
      school: school || null,
      avatar: avatar || null,
      grade: grade ?? null,
      language_preference,
    })
    .eq('id', userId)
    .select(
      'id, username, account_type, grade, parent_code, created_at, display_name, email, school, avatar, wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, milestone_settings, is_premium, language_preference'
    )
    .single()
  if (error) throw error
  return data
}

export default createStudentHandler({ method: 'POST', validate, handle })
