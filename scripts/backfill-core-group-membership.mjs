// One-time backfill: auto-joins every existing student who already has
// both a school and grade set to their school's core-subject unclaimed
// groups (Math, Science, History & Geography, English, French), matching
// the auto-join behavior now wired into api/student/update-settings.js and
// api/admin/resolve-school-change-request.js going forward. Without this,
// only a student who sets/changes their school or grade AFTER this feature
// shipped would get auto-joined — this catches everyone who set theirs
// before.
//
// Requires in .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (same
// connection pattern as scripts/migrate-to-canada.js). Constructs its own
// client rather than importing api/_lib/auth.js's singleton — that file
// reads process.env at import time, which would run before this script's
// own process.loadEnvFile() call below (ES module imports always resolve
// before the importing module's own top-level statements, regardless of
// where those statements are written in the file).
//
// Run: node scripts/backfill-core-group-membership.mjs
//
// Safe to re-run: every join is an upsert with ignoreDuplicates (same as
// autoJoinCoreGroups itself), so re-running just finds nothing new to add
// the second time.
process.loadEnvFile()

import { createClient } from '@supabase/supabase-js'
import { CORE_SUBJECT_IDS } from '../src/lib/questions.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env — aborting.')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  const { data: students, error: studentsError } = await supabase
    .from('users')
    .select('id, school_id, grade')
    .eq('account_type', 'student')
    .is('deleted_at', null)
    .not('school_id', 'is', null)
    .not('grade', 'is', null)
  if (studentsError) throw studentsError

  console.log(`Found ${students.length} student(s) with both school and grade set.`)
  if (students.length === 0) {
    console.log('Nothing to backfill.')
    return
  }

  // One core-subject-groups query per distinct (school_id, grade) pair
  // rather than per student — a handful of pairs cover every student at a
  // given school+grade, so this stays cheap even as the student count
  // grows, unlike a naive per-student query loop.
  const pairKey = (schoolId, grade) => `${schoolId}|${grade}`
  const groupIdsByPair = new Map()
  const uniquePairs = new Map()
  for (const s of students) {
    uniquePairs.set(pairKey(s.school_id, s.grade), { schoolId: s.school_id, grade: s.grade })
  }

  for (const { schoolId, grade } of uniquePairs.values()) {
    const { data: groups, error: groupsError } = await supabase
      .from('school_subject_groups')
      .select('id')
      .eq('school_id', schoolId)
      .eq('grade', grade)
      .in('subject', CORE_SUBJECT_IDS)
    if (groupsError) throw groupsError
    groupIdsByPair.set(pairKey(schoolId, grade), (groups || []).map((g) => g.id))
  }

  const rows = []
  for (const s of students) {
    const groupIds = groupIdsByPair.get(pairKey(s.school_id, s.grade)) || []
    for (const groupId of groupIds) {
      rows.push({ group_id: groupId, student_id: s.id })
    }
  }

  console.log(`Upserting ${rows.length} membership row(s) (existing memberships are skipped, not duplicated)...`)

  const CHUNK_SIZE = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from('school_subject_group_students').upsert(chunk, { onConflict: 'group_id,student_id', ignoreDuplicates: true })
    if (error) throw error
    upserted += chunk.length
  }

  console.log(`✓ Done. Processed ${students.length} students across ${uniquePairs.size} school+grade pair(s), upserted ${upserted} membership row(s) total.`)
}

main().catch((err) => {
  console.error('\n✗ Backfill failed:', err)
  process.exit(1)
})
