// One-time, school-specific seed: declares St. Thomas High School's
// elective subjects into school_electives. This is the ONLY St. Thomas-
// specific file in this feature — everything else (the school_electives
// table itself, the sync script, every API/UI change) is generic and
// works for any school's own elective list added the same way later.
//
// Looks the school up by name at run time rather than hardcoding its uuid,
// so this stays correct across environments (e.g. a fresh database seeded
// from schema.sql, which creates schools with fresh generated ids).
//
// After this, run scripts/sync-school-electives.mjs to actually create the
// matching school_subject_groups rows the app reads from — this script
// only writes the declaration, not the materialized groups.
//
// Requires in .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Run: node scripts/seed-st-thomas-electives.mjs
// Safe to re-run: on conflict (school_id, subject, grade) do nothing,
// equivalent via upsert+ignoreDuplicates below.
process.loadEnvFile()

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env — aborting.')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SCHOOL_NAME = 'St. Thomas High School'

// Physics/Chemistry: full electives, Grade 11 only.
// Woodwork/Art/Music/Cooking/Drama: lighter electives, Grades 9-11.
// Leadership: lighter elective, Grade 11 only.
const ELECTIVES = [
  { subject: 'physics', grades: [11] },
  { subject: 'chemistry', grades: [11] },
  { subject: 'woodwork', grades: [9, 10, 11] },
  { subject: 'art', grades: [9, 10, 11] },
  { subject: 'music', grades: [9, 10, 11] },
  { subject: 'cooking', grades: [9, 10, 11] },
  { subject: 'drama', grades: [9, 10, 11] },
  { subject: 'leadership', grades: [11] },
]

async function main() {
  const { data: school, error: schoolError } = await supabase.from('schools').select('id, name').ilike('name', SCHOOL_NAME).maybeSingle()
  if (schoolError) throw schoolError
  if (!school) {
    console.error(`Could not find a school named "${SCHOOL_NAME}" — aborting.`)
    process.exit(1)
  }
  console.log(`Found school: ${school.name} (${school.id})`)

  const rows = []
  for (const { subject, grades } of ELECTIVES) {
    for (const grade of grades) {
      rows.push({ school_id: school.id, subject, grade })
    }
  }
  console.log(`Seeding ${rows.length} school_electives row(s):`, rows.map((r) => `${r.subject}/${r.grade}`).join(', '))

  const { error } = await supabase.from('school_electives').upsert(rows, { onConflict: 'school_id,subject,grade', ignoreDuplicates: true })
  if (error) throw error

  console.log('✓ Done. Run scripts/sync-school-electives.mjs next to materialize these into school_subject_groups.')
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err)
  process.exit(1)
})
