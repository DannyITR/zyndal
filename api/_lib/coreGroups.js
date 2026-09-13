import { CORE_SUBJECT_IDS } from '../../src/lib/questions.js'

// Auto-joins a student to every core-subject (Math/Science/History &
// Geography/English/French) unclaimed group for their school+grade —
// these are always-on memberships now, not something a student opts into
// (see CORE_SUBJECT_IDS in src/lib/questions.js and ClassCardsGrid.jsx's
// Join button, hidden for exactly these subjects). Elective groups, if any
// exist in the future, are untouched here — a student still joins those
// manually via join-school-subject-group.js.
//
// Takes the supabase client as a parameter rather than importing the
// singleton from ./auth.js, so this exact same logic can be reused by both
// the live API endpoints (update-settings.js, resolve-school-change-
// request.js — pass their own already-configured singleton) and the
// one-time backfill script (scripts/backfill-core-group-membership.mjs),
// which can't safely import ./auth.js's singleton — that file reads
// process.env at import time, before a standalone script's own
// process.loadEnvFile() call (which always runs after ES module imports
// are resolved, regardless of where it's written in the file) would have
// populated it.
//
// No-ops (not an error) if either schoolId or grade is missing — a student
// who's set one but not the other has nothing to join yet; this runs again
// automatically the next time whichever value is still missing gets set
// (see both call sites, which re-check with the freshly-saved values after
// every school_id/grade update, covering either order).
export async function autoJoinCoreGroups(supabase, userId, schoolId, grade) {
  if (!schoolId || !grade) return

  const { data: groups, error: groupsError } = await supabase
    .from('school_subject_groups')
    .select('id')
    .eq('school_id', schoolId)
    .eq('grade', grade)
    .in('subject', CORE_SUBJECT_IDS)
  if (groupsError) throw groupsError
  if (!groups || groups.length === 0) return

  const rows = groups.map((g) => ({ group_id: g.id, student_id: userId }))
  const { error: joinError } = await supabase
    .from('school_subject_group_students')
    .upsert(rows, { onConflict: 'group_id,student_id', ignoreDuplicates: true })
  if (joinError) throw joinError
}
