// Generic, reusable, re-runnable: reads EVERY row in school_electives
// (any school, not just St. Thomas) and ensures a matching
// school_subject_groups row exists for each — the row the app actually
// reads everywhere (get-school-subject-groups.js, teacher claim list,
// etc.). This is the real "extensible per-school electives" mechanism:
// adding a different school's own elective list later is just inserting
// rows into school_electives (see scripts/seed-st-thomas-electives.mjs for
// the pattern) and re-running this one script — no code change needed.
//
// Requires in .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Run: node scripts/sync-school-electives.mjs
// Safe to re-run: upsert with ignoreDuplicates, same pattern as
// api/_lib/coreGroups.js's own auto-join upsert.
process.loadEnvFile()

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env — aborting.')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  const { data: electives, error } = await supabase.from('school_electives').select('school_id, subject, grade')
  if (error) throw error

  console.log(`Found ${electives.length} school_electives row(s) across all schools.`)
  if (electives.length === 0) {
    console.log('Nothing to sync.')
    return
  }

  const rows = electives.map((e) => ({ school_id: e.school_id, subject: e.subject, grade: e.grade }))
  const { error: upsertError, count } = await supabase
    .from('school_subject_groups')
    .upsert(rows, { onConflict: 'school_id,subject,grade', ignoreDuplicates: true, count: 'exact' })
  if (upsertError) throw upsertError

  console.log(`✓ Done. Ensured ${rows.length} school_subject_groups row(s) exist (new rows created: ${count ?? 'unknown'}).`)
}

main().catch((err) => {
  console.error('\n✗ Sync failed:', err)
  process.exit(1)
})
