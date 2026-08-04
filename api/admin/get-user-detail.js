import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { getProgressForUser } from '../_lib/db.js'
import { usernameLookup } from '../_lib/parentDb.js'
import { getSubscriptionStatus } from '../_lib/subscription.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

// Everything except password — same intent as db.js's SAFE_USER_COLUMNS,
// but this is the admin's own column list (includes deleted_at, which a
// regular user never sees about themselves) rather than reusing that one.
const USER_COLUMNS =
  'id, username, account_type, grade, parent_code, created_at, display_name, email, school, avatar, ' +
  'wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, is_premium, ' +
  'email_verified, deleted_at, timezone, language_preference, trial_started_at, trial_ends_at, is_paying_subscriber'

function validate(body) {
  const userId = sanitizeUuid(body.user_id)
  if (!userId) return { field: 'user_id', message: 'A valid user_id is required.' }
  body.user_id = userId
  return null
}

async function handle({ body }) {
  const userId = body.user_id

  const { data: user, error: userError } = await supabase.from('users').select(USER_COLUMNS).eq('id', userId).maybeSingle()
  if (userError) throw userError
  if (!user) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  Object.assign(user, getSubscriptionStatus(user))

  const [
    progress,
    { data: grades, error: gradesError },
    { data: uploads, error: uploadsError },
    { data: studyPlans, error: studyPlansError },
    { data: linksAsParent, error: linksAsParentError },
    { data: linksAsStudent, error: linksAsStudentError },
    { data: friendRows, error: friendsError },
    { data: notifications, error: notificationsError },
  ] = await Promise.all([
    // Reuses the exact same student-facing progress builder (hardcoded-bank/
    // generated-pool question lookup, timezone-aware date bucketing) instead
    // of re-querying answers directly — the Edit User page's calendar and
    // day-detail view need the same enriched shape (correctAnswer, options,
    // local date) StudentHome.jsx's own history already relies on.
    getProgressForUser(userId, user.timezone),
    supabase.from('grades').select('*').eq('user_id', userId).order('test_date', { ascending: false }),
    supabase.from('uploads').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('study_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('parent_student').select('*').eq('parent_id', userId),
    supabase.from('parent_student').select('*').eq('student_id', userId),
    supabase.from('friends').select('friend_id, created_at').eq('user_id', userId),
    supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
  ])
  if (gradesError) throw gradesError
  if (uploadsError) throw uploadsError
  if (studyPlansError) throw studyPlansError
  if (linksAsParentError) throw linksAsParentError
  if (linksAsStudentError) throw linksAsStudentError
  if (friendsError) throw friendsError
  if (notificationsError) throw notificationsError

  // Batched, not embedded selects — parent_student has two FKs into users
  // (parent_id and student_id), which makes PostgREST's automatic
  // relationship embedding ambiguous without an explicit constraint-name
  // hint. usernameLookup (already shared by api/parent/get-dashboard.js)
  // sidesteps that entirely with a plain second query.
  const relatedIds = [
    ...(linksAsParent || []).map((l) => l.student_id),
    ...(linksAsStudent || []).map((l) => l.parent_id),
    ...(friendRows || []).map((f) => f.friend_id),
  ]
  const usernameById = await usernameLookup([...new Set(relatedIds)])

  const totalAnswered = progress.history.length
  const totalCorrect = progress.history.filter((h) => h.correct).length

  return {
    user,
    stats: {
      currentStreak: progress.streak,
      longestStreak: progress.longestStreak,
      totalXp: progress.xp,
      coinBalance: progress.coins,
      totalAnswered,
      totalCorrect,
      accuracyPercent: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
      memberSince: user.created_at,
      // progress.history is ordered ascending by answered_at, so the last
      // entry is the most recent.
      lastActive: totalAnswered > 0 ? progress.history[totalAnswered - 1].date : null,
    },
    answerHistory: progress.history,
    grades: grades || [],
    uploads: uploads || [],
    studyPlans: studyPlans || [],
    parentLinks: {
      asParent: (linksAsParent || []).map((l) => ({ ...l, studentUsername: usernameById[l.student_id] || 'Unknown' })),
      asStudent: (linksAsStudent || []).map((l) => ({ ...l, parentUsername: usernameById[l.parent_id] || 'Unknown' })),
    },
    friends: (friendRows || []).map((f) => ({ friendId: f.friend_id, since: f.created_at, username: usernameById[f.friend_id] || 'Unknown' })),
    notifications: notifications || [],
  }
}

export default createAdminHandler({ method: 'GET', validate, handle })
