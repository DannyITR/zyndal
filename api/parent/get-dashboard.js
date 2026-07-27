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

async function handle({ parentId }) {
  const [links, walletRow, payoutHistory] = await Promise.all([
    getParentLinks(parentId),
    getParentWalletRow(parentId),
    getPayoutHistoryRows(parentId),
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
    }
  }

  const [studentRows, streakRows, answerRows, practiceRows, gradeRows, studyPlanRows, testGradeRows, achievementRows, gradeBonusRows] =
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
    ])

  const streakByStudent = Object.fromEntries(streakRows.map((s) => [s.user_id, s]))
  const answersByStudent = groupBy(answerRows, 'user_id')
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
  }
}

export default createParentHandler({ method: 'GET', handle })
