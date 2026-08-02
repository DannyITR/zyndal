import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { toProgress } from '../_lib/db.js'
import { getParentLinks, getStudentRows, getParentWalletRow, walletRowToJson, getPayoutHistoryRows, usernameLookup } from '../_lib/parentDb.js'
import { todayStr } from '../../src/lib/streak.js'

// The one aggregate read for the whole parent experience (ParentDashboard +
// FinanceScreen): every linked student's progress/practice/grades, plus the
// parent's own wallet, active study plans, graded tests, and pending
// bonuses — all in a single round trip. storage.js caches this response and
// slices it into the same set of small functions (getStudentsForParent,
// getParentWallet, getPayoutHistory, etc.) those two screens already called
// individually, so no component needed to change to consume one big call
// instead of many small ones. Wallet fields and payout history aren't
// explicitly listed in this endpoint's spec, but there's no other GET route
// that could ever serve them to the client, so they're included here as the
// only sensible home for that data.
function defaultStreakRow(userId) {
  return { user_id: userId, current_streak: 0, longest_streak: 0, last_answered_date: null, total_xp: 0, coin_balance: 0 }
}

function groupBy(rows, key) {
  const grouped = {}
  for (const row of rows) {
    ;(grouped[row[key]] ||= []).push(row)
  }
  return grouped
}

// "Pending" badge on the parent dashboard — sourced live from this table's
// own status column, which every linking path (link-request.js's send,
// respond-parent-link.js's accept/decline, link-parent.js's code-entry
// path — including the auto-call right after a parent-code signup) keeps
// current. Expired-but-still-'pending' rows are filtered out client-side
// of this query (an unresolved cron to flip them to 'expired' isn't worth
// building just to hide a stale badge a bit sooner).
async function getPendingInvitations(parentId) {
  const { data: invitations, error } = await supabase
    .from('parent_invitations')
    .select('id, student_id, child_email, invite_type, sent_at, expires_at')
    .eq('parent_id', parentId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('sent_at', { ascending: false })
  if (error) throw error
  if (!invitations || invitations.length === 0) return []

  const studentIds = [...new Set(invitations.filter((i) => i.student_id).map((i) => i.student_id))]
  const usernameById = studentIds.length ? await usernameLookup(studentIds) : {}

  return invitations.map((i) => ({
    id: i.id,
    label: i.student_id ? `@${usernameById[i.student_id] || 'Unknown'}` : i.child_email,
    inviteType: i.invite_type,
    sentAt: i.sent_at,
  }))
}

async function handle({ parentId }) {
  const [links, walletRow, payoutHistory, pendingInvitations] = await Promise.all([
    getParentLinks(parentId),
    getParentWalletRow(parentId),
    getPayoutHistoryRows(parentId),
    getPendingInvitations(parentId),
  ])
  const studentIds = links.map((l) => l.student_id)
  const linkByStudentId = Object.fromEntries(links.map((l) => [l.student_id, l]))

  if (studentIds.length === 0) {
    return {
      wallet: walletRowToJson(walletRow),
      students: [],
      studyPlans: [],
      testGrades: [],
      pendingPerfectWeekAchievements: [],
      pendingGradeBonuses: [],
      payoutHistory,
      pendingInvitations,
    }
  }

  const [studentRows, streakRows, answerRows, practiceRows, gradeRows, studyPlanRows, testGradeRows, achievementRows, gradeBonusRows, workSubmissionRows] =
    await Promise.all([
      getStudentRows(studentIds),
      supabase.from('streaks').select('*').in('user_id', studentIds).then((r) => r.data || []),
      supabase
        .from('answers')
        .select('*')
        .in('user_id', studentIds)
        .order('answered_at', { ascending: true })
        .then((r) => r.data || []),
      supabase
        .from('practice_sessions')
        .select('*')
        .in('user_id', studentIds)
        .order('completed_at', { ascending: false })
        .then((r) => r.data || []),
      supabase
        .from('grades')
        .select('*')
        .in('user_id', studentIds)
        .order('test_date', { ascending: false })
        .then((r) => r.data || []),
      supabase
        .from('study_plans')
        .select('*')
        .in('user_id', studentIds)
        .eq('status', 'active')
        .gte('test_date', todayStr())
        .order('test_date', { ascending: true })
        .then((r) => r.data || []),
      supabase
        .from('uploads')
        .select('*')
        .in('user_id', studentIds)
        .eq('document_type', 'test')
        .not('grade_received', 'is', null)
        .order('test_date', { ascending: false })
        .then((r) => r.data || []),
      supabase
        .from('perfect_week_achievements')
        .select('*')
        .eq('parent_id', parentId)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .then((r) => r.data || []),
      supabase
        .from('grade_bonuses')
        .select('*, uploads(subject, topic), grades(subject, test_name)')
        .eq('parent_id', parentId)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .then((r) => r.data || []),
      // Scratchpad is Math-only — other subjects may be added in future.
      // Resolved submissions only (approved IS NOT NULL) — a Math homework
      // submission still awaiting teacher review has nothing to show here
      // yet (see get-class-detail.js's pendingWorkReviewCount for that
      // side of it). image_base64 is deliberately not selected — the
      // parent activity feed only needs date/question/status per spec.
      // feedback_given, when set alongside an approved row, distinguishes
      // a retry_correct_log entry ("correct after hint") from a normal
      // correct_work_submission approval — see grade-work.js's comment on
      // why that column combination is the marker.
      supabase
        .from('work_submissions')
        .select('id, user_id, question_text, approved, submitted_at, feedback_given')
        .in('user_id', studentIds)
        .not('approved', 'is', null)
        .order('submitted_at', { ascending: false })
        .then((r) => r.data || []),
    ])

  const streakByStudent = Object.fromEntries(streakRows.map((s) => [s.user_id, s]))
  const answersByStudent = groupBy(answerRows, 'user_id')
  const workSubmissionsByStudent = groupBy(workSubmissionRows, 'user_id')
  const practiceByStudent = groupBy(practiceRows, 'user_id')
  const gradesByStudent = groupBy(gradeRows, 'user_id')
  const usernameById = Object.fromEntries(studentRows.map((s) => [s.id, s.username]))
  const nameById = Object.fromEntries(studentRows.map((s) => [s.id, s.display_name || s.username]))

  const students = studentRows.map((s) => {
    const link = linkByStudentId[s.id] || {}
    return {
      ...s,
      perfectWeekBonus: Number(link.perfect_week_bonus ?? 10),
      gradeRewardAPlusCents: link.grade_reward_a_plus_cents ?? 2500,
      gradeRewardACents: link.grade_reward_a_cents ?? 1500,
      gradeRewardBCents: link.grade_reward_b_cents ?? 1000,
      gradeRewardCCents: link.grade_reward_c_cents ?? 500,
      progress: toProgress(streakByStudent[s.id] || defaultStreakRow(s.id), answersByStudent[s.id] || []),
      recentPracticeSessions: (practiceByStudent[s.id] || []).slice(0, 5),
      grades: gradesByStudent[s.id] || [],
      workSubmissions: (workSubmissionsByStudent[s.id] || []).slice(0, 20).map((w) => ({
        id: w.id,
        questionText: w.question_text,
        approved: w.approved,
        submittedAt: w.submitted_at,
        correctAfterHint: Boolean(w.approved && w.feedback_given),
      })),
    }
  })

  const achievementStudentIds = [...new Set(achievementRows.map((r) => r.student_id))]
  const achievementUsernameById = await usernameLookup(achievementStudentIds)
  const bonusStudentIds = [...new Set(gradeBonusRows.map((r) => r.student_id))]
  const bonusUsernameById = await usernameLookup(bonusStudentIds)

  return {
    wallet: walletRowToJson(walletRow),
    students,
    studyPlans: studyPlanRows.map((plan) => ({ ...plan, studentName: nameById[plan.user_id] || 'Unknown' })),
    testGrades: testGradeRows.map((row) => ({ ...row, studentName: nameById[row.user_id] || 'Unknown' })),
    pendingPerfectWeekAchievements: achievementRows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      studentUsername: achievementUsernameById[r.student_id] || usernameById[r.student_id] || 'Unknown',
      weekStart: r.week_start,
      suggestedBonusCents: r.suggested_bonus_cents,
    })),
    pendingGradeBonuses: gradeBonusRows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      studentUsername: bonusUsernameById[r.student_id] || usernameById[r.student_id] || 'Unknown',
      subject: r.uploads?.subject || r.grades?.subject,
      topic: r.uploads?.topic || r.grades?.test_name,
      gradeReceived: r.grade_received,
      suggestedBonusCents: r.suggested_bonus_cents,
    })),
    payoutHistory,
    pendingInvitations,
  }
}

export default createParentHandler({ method: 'GET', handle })
