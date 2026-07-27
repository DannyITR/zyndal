// Server-side mirrors of a few PRIVATE (non-exported) helpers in
// src/lib/storage.js — that file can't be imported directly here because it
// pulls in supabaseClient.js, which references `localStorage` and doesn't
// exist in a Node.js serverless environment. The pure logic (no browser
// dependencies) still comes straight from src/lib/streak.js and
// src/lib/questions.js via relative import, so the actual game-logic
// algorithm stays byte-identical between client and server — only the
// Supabase I/O glue is duplicated here.
import { supabase } from './auth.js'
import { DEFAULT_MILESTONE_BONUSES, PERFECT_WEEK_TARGET, mondayOfWeek } from '../../src/lib/streak.js'
import { findQuestionByPrompt } from '../../src/lib/questions.js'

export async function getStreakRow(userId) {
  const { data, error } = await supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) return data

  const { data: created, error: insertError } = await supabase.from('streaks').insert({ user_id: userId }).select().single()
  if (insertError) throw insertError
  return created
}

// Mirrors rowToEntry in storage.js exactly.
function rowToEntry(row) {
  const match = findQuestionByPrompt(row.subject, row.question_text)
  const selectedIndex = match ? match.options.indexOf(row.selected_answer) : -1
  return {
    id: row.id,
    date: row.answered_at.slice(0, 10),
    subjectId: row.subject,
    prompt: row.question_text,
    correct: row.correct,
    correctIndex: match?.correctIndex,
    options: match?.options,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    selectedAnswer: row.selected_answer,
    correctAnswer: match ? match.options[match.correctIndex] : null,
    xpEarned: row.correct ? 1 : 0,
    coinsEarned: row.correct ? 1 : 0,
  }
}

// Mirrors toProgress + getProgress in storage.js exactly.
export function toProgress(streakRow, answerRows) {
  return {
    studentId: streakRow.user_id,
    streak: streakRow.current_streak,
    longestStreak: streakRow.longest_streak,
    xp: streakRow.total_xp,
    coins: streakRow.coin_balance,
    lastCorrectDate: streakRow.last_answered_date,
    history: answerRows.map(rowToEntry),
  }
}

export async function getProgressForUser(userId) {
  const streakRow = await getStreakRow(userId)
  const { data: answerRows, error } = await supabase
    .from('answers')
    .select('*')
    .eq('user_id', userId)
    .order('answered_at', { ascending: true })
  if (error) throw error
  return toProgress(streakRow, answerRows || [])
}

// Mirrors getLinkedParent in storage.js exactly.
export async function getLinkedParent(studentId) {
  const { data: link, error: linkError } = await supabase
    .from('parent_student')
    .select(
      'parent_id, perfect_week_bonus, grade_reward_a_plus_cents, grade_reward_a_cents, grade_reward_b_cents, grade_reward_c_cents'
    )
    .eq('student_id', studentId)
    .maybeSingle()
  if (linkError) throw linkError
  if (!link) return null

  const { data: parent, error: parentError } = await supabase
    .from('users')
    .select('milestone_settings')
    .eq('id', link.parent_id)
    .maybeSingle()
  if (parentError) throw parentError

  return {
    parentId: link.parent_id,
    perfectWeekBonusDollars: Number(link.perfect_week_bonus ?? 10),
    milestoneSettings: parent?.milestone_settings ?? null,
    gradeRewardAPlusCents: link.grade_reward_a_plus_cents ?? 2500,
    gradeRewardACents: link.grade_reward_a_cents ?? 1500,
    gradeRewardBCents: link.grade_reward_b_cents ?? 1000,
    gradeRewardCCents: link.grade_reward_c_cents ?? 500,
  }
}

// Mirrors normalizeMilestoneBonuses in storage.js exactly.
export function normalizeMilestoneBonuses(milestoneSettings) {
  if (!milestoneSettings) return DEFAULT_MILESTONE_BONUSES
  const normalized = {}
  for (const [day, bonus] of Object.entries(milestoneSettings)) {
    normalized[Number(day)] = Number(bonus)
  }
  return normalized
}

// Mirrors recordPerfectWeekAchievement in storage.js exactly.
export async function recordPerfectWeekAchievement(studentId, parentId, perfectWeekBonusDollars, today) {
  const weekStart = mondayOfWeek(today)
  const suggestedBonusCents = Math.round(perfectWeekBonusDollars * 100)

  const { data, error } = await supabase
    .from('perfect_week_achievements')
    .insert({
      student_id: studentId,
      parent_id: parentId,
      week_start: weekStart,
      correct_count: PERFECT_WEEK_TARGET,
      suggested_bonus_cents: suggestedBonusCents,
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return null // already recorded this week
    throw error
  }
  return data
}
