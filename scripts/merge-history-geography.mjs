// One-time data migration: merges the standalone "history" and "geography"
// subjects into one combined "history_geography" subject ("History &
// Geography"), following the app-wide code merge in src/lib/questions.js,
// src/lib/testPrepQuestionBank.js, ClassCard.jsx, and the translation files.
//
// Read-only reconnaissance against production (see the conversation this
// script came from) found, as of writing:
//   - school_subject_groups: 110 rows (11 schools x 5 grades x 2 subjects)
//   - school_subject_group_students: 1 membership row on those groups
//   - curriculum_outlines: 30 rows (5 grades x 2 subjects x 3 languages),
//     full coverage — every combination already generated
//   - answers: 124 rows, daily_question_locks: 5 rows, practice_sessions: 1 row
//   - classes (teacher-claimed) and teacher_claims: ZERO rows for either
//     subject — no dual-teacher conflict exists. Step 0 below re-checks this
//     at run time and aborts rather than guessing if that's changed.
//   - grades, study_plans, uploads, upload_weekly_usage, generated_questions:
//     zero rows for either subject (handled defensively anyway, in case any
//     appear between when this was written and when you run it)
//
// Requires in .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (same
// connection pattern as scripts/migrate-to-canada.js).
//
// Run: node scripts/merge-history-geography.mjs
//
// Safe to re-run: every step is idempotent — rows already merged/renamed are
// simply not found the second time (matched by subject = 'history' or
// 'geography', which won't exist anymore after a successful run).
process.loadEnvFile()

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env — aborting.')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const OLD_SUBJECTS = ['history', 'geography']
const NEW_SUBJECT = 'history_geography'
const NEW_SUBJECT_NAME = 'History & Geography'
const GRADES = [7, 8, 9, 10, 11]
const LANGUAGES = ['en', 'fr', 'es']

function fail(message) {
  console.error('\n✗ ABORTED: ' + message)
  process.exit(1)
}

async function step0_safetyCheck() {
  console.log('Step 0: checking for a dual-teacher conflict (teacher-claimed classes on either subject)...')

  const { data: claimedClasses, error: classesError } = await supabase
    .from('classes')
    .select('id, name, teacher_id, school, grade, subject')
    .in('subject', OLD_SUBJECTS)
  if (classesError) throw classesError

  const { data: groups, error: groupsError } = await supabase.from('school_subject_groups').select('id').in('subject', OLD_SUBJECTS)
  if (groupsError) throw groupsError
  const groupIds = groups.map((g) => g.id)

  const { data: claims, error: claimsError } =
    groupIds.length > 0
      ? await supabase.from('teacher_claims').select('id, teacher_id, group_id, status').in('group_id', groupIds)
      : { data: [], error: null }
  if (claimsError) throw claimsError

  if (claimedClasses.length > 0 || claims.length > 0) {
    console.error('\nFound teacher-claimed History/Geography classes or claims — this needs a human decision, not an automatic merge:')
    console.error('classes:', JSON.stringify(claimedClasses, null, 2))
    console.error('teacher_claims:', JSON.stringify(claims, null, 2))
    fail(
      'A dual-teacher conflict may exist (or a single-teacher double-claim that is still safe to merge) — inspect the rows above and decide manually before re-running. Nothing has been changed.',
    )
  }
  console.log('  OK — no teacher-claimed classes or claims exist for either subject.\n')
}

async function step1_mergeSchoolSubjectGroups() {
  console.log('Step 1: merging school_subject_groups...')
  const { data: rows, error } = await supabase.from('school_subject_groups').select('id, school_id, subject, grade').in('subject', OLD_SUBJECTS)
  if (error) throw error

  const bySchoolGrade = new Map() // `${school_id}|${grade}` -> { history?, geography? }
  for (const row of rows) {
    const key = `${row.school_id}|${row.grade}`
    if (!bySchoolGrade.has(key)) bySchoolGrade.set(key, {})
    bySchoolGrade.get(key)[row.subject] = row
  }

  let merged = 0
  let renamedOnly = 0
  for (const pair of bySchoolGrade.values()) {
    const keep = pair.history || pair.geography
    const drop = pair.history ? pair.geography : null
    if (!keep) continue

    if (drop) {
      // Repoint memberships from the dropped group to the kept group,
      // skipping any student already a member of both (would otherwise
      // violate unique(group_id, student_id) on the kept group).
      const { data: keptMembers, error: keptError } = await supabase.from('school_subject_group_students').select('student_id').eq('group_id', keep.id)
      if (keptError) throw keptError
      const keptStudentIds = new Set(keptMembers.map((m) => m.student_id))

      const { data: dropMembers, error: dropError } = await supabase.from('school_subject_group_students').select('id, student_id').eq('group_id', drop.id)
      if (dropError) throw dropError

      for (const member of dropMembers) {
        if (keptStudentIds.has(member.student_id)) {
          const { error: delError } = await supabase.from('school_subject_group_students').delete().eq('id', member.id)
          if (delError) throw delError
        } else {
          const { error: updError } = await supabase.from('school_subject_group_students').update({ group_id: keep.id }).eq('id', member.id)
          if (updError) throw updError
        }
      }

      const { error: dropDeleteError } = await supabase.from('school_subject_groups').delete().eq('id', drop.id)
      if (dropDeleteError) throw dropDeleteError
      merged++
    } else {
      renamedOnly++
    }

    const { error: renameError } = await supabase.from('school_subject_groups').update({ subject: NEW_SUBJECT }).eq('id', keep.id)
    if (renameError) throw renameError
  }
  console.log(`  Merged ${merged} school+grade pairs (both groups existed); renamed ${renamedOnly} that only had one side.\n`)
}

function renumberUnits(units) {
  return units.map((unit, i) => ({ ...unit, unit_number: i + 1 }))
}

async function step2_mergeCurriculumOutlines() {
  console.log('Step 2: merging curriculum_outlines...')
  let mergedCount = 0
  for (const grade of GRADES) {
    for (const language of LANGUAGES) {
      const { data: rows, error } = await supabase
        .from('curriculum_outlines')
        .select('id, subject, grade, language, outline_data')
        .eq('grade', grade)
        .eq('language', language)
        .in('subject', OLD_SUBJECTS)
      if (error) throw error

      const history = rows.find((r) => r.subject === 'history')
      const geography = rows.find((r) => r.subject === 'geography')
      if (!history && !geography) continue

      const historyUnits = history?.outline_data?.units || []
      const geoUnits = geography?.outline_data?.units || []
      const mergedOutline = {
        subject: NEW_SUBJECT_NAME,
        grade,
        units: renumberUnits([...historyUnits, ...geoUnits]),
      }

      const { error: insertError } = await supabase
        .from('curriculum_outlines')
        .insert({ subject: NEW_SUBJECT, grade, language, outline_data: mergedOutline })
      if (insertError) throw insertError

      const idsToDelete = [history?.id, geography?.id].filter(Boolean)
      const { error: deleteError } = await supabase.from('curriculum_outlines').delete().in('id', idsToDelete)
      if (deleteError) throw deleteError

      mergedCount++
      console.log(`  grade ${grade} / ${language}: ${historyUnits.length} history units + ${geoUnits.length} geography units -> ${mergedOutline.units.length} units`)
    }
  }
  console.log(`  Merged ${mergedCount} grade+language outline pairs.\n`)
}

async function step3_relabelHistoricalRecords() {
  console.log('Step 3: relabeling historical subject-tagged rows...')
  const tables = ['answers', 'daily_question_locks', 'practice_sessions', 'grades', 'study_plans', 'uploads', 'upload_weekly_usage', 'generated_questions']
  for (const table of tables) {
    const { count, error: countError } = await supabase.from(table).select('*', { count: 'exact', head: true }).in('subject', OLD_SUBJECTS)
    if (countError) throw countError
    if (count > 0) {
      const { error: updateError } = await supabase.from(table).update({ subject: NEW_SUBJECT }).in('subject', OLD_SUBJECTS)
      if (updateError) throw updateError
    }
    console.log(`  ${table}: ${count ?? 0} row(s) relabeled to '${NEW_SUBJECT}'`)
  }
  console.log()
}

async function main() {
  await step0_safetyCheck()
  await step1_mergeSchoolSubjectGroups()
  await step2_mergeCurriculumOutlines()
  await step3_relabelHistoricalRecords()
  console.log('✓ Done. History and Geography are now merged into history_geography everywhere in the database.')
}

main().catch((err) => {
  console.error('\n✗ Migration failed:', err)
  process.exit(1)
})
