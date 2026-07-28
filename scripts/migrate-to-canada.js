// One-time data migration: copies every row from every table in the old
// (US-hosted) Supabase project into the new Canadian-hosted project,
// preserving primary keys so foreign-key relationships stay intact.
//
// Read-only against the source — this script never deletes or modifies
// anything in the old project. It also does NOT touch app code, Vercel
// config, or the app's own env vars — cutting the app over to the new
// project is a separate, deliberate step (see below).
//
// STATUS: already run — the app's own .env now points VITE_SUPABASE_URL/
// SUPABASE_SERVICE_ROLE_KEY at the new (Canadian) project directly, so the
// NEW_SUPABASE_URL/NEW_SUPABASE_SERVICE_ROLE_KEY vars this script needs
// were removed from .env after cutover. Kept here as a record of how the
// migration was done — re-add those two vars (pointed at wherever "new"
// means at that point) before running this again.
//
// Requires in .env:
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY       (source project)
//   NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY    (destination project)
//
// Run: node scripts/migrate-to-canada.js
//
// Safe to re-run: rows are upserted on `id` (every table here has a uuid
// `id` primary key — see supabase/schema.sql), so re-running after a
// partial failure fills in what's missing instead of erroring on
// already-migrated rows.
process.loadEnvFile()

import { createClient } from '@supabase/supabase-js'

const OLD_URL = process.env.VITE_SUPABASE_URL
const OLD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const NEW_URL = process.env.NEW_SUPABASE_URL
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY

for (const [name, value] of Object.entries({
  VITE_SUPABASE_URL: OLD_URL,
  SUPABASE_SERVICE_ROLE_KEY: OLD_KEY,
  NEW_SUPABASE_URL: NEW_URL,
  NEW_SUPABASE_SERVICE_ROLE_KEY: NEW_KEY,
})) {
  if (!value) {
    console.error(`Missing ${name} in .env — aborting.`)
    process.exit(1)
  }
}

const oldClient = createClient(OLD_URL, OLD_KEY)
const newClient = createClient(NEW_URL, NEW_KEY)

// Exact order required to satisfy foreign keys (each table only references
// ones earlier in this list) — do not reorder.
const TABLES = [
  'users',
  'sessions',
  'streaks',
  'answers',
  'parent_student',
  'payouts',
  'perfect_week_achievements',
  'friend_requests',
  'friends',
  'streak_shares',
  'uploads',
  'upload_questions',
  'grades',
  'grade_bonuses',
  'study_plans',
  'practice_sessions',
  'curriculum_outlines',
]

const PAGE_SIZE = 500

async function fetchAllRows(table) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await oldClient.from(table).select('*').range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`[${table}] read from old project failed: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function insertRows(table, rows) {
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    const chunk = rows.slice(i, i + PAGE_SIZE)
    const { error } = await newClient.from(table).upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(`[${table}] insert into new project failed: ${error.message}`)
  }
}

async function exactCount(client, table) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`[${table}] count failed: ${error.message}`)
  return count
}

async function migrateTable(table) {
  const rows = await fetchAllRows(table)
  if (rows.length > 0) await insertRows(table, rows)
  console.log(`Migrating ${table}... ${rows.length} rows copied`)
}

async function verifyCounts() {
  console.log('\nVerifying row counts (old vs. new)...')
  let allMatch = true
  const results = []
  for (const table of TABLES) {
    const [oldCount, newCount] = await Promise.all([exactCount(oldClient, table), exactCount(newClient, table)])
    const match = oldCount === newCount
    if (!match) allMatch = false
    results.push({ table, oldCount, newCount, match })
    console.log(`  ${match ? '✅' : '❌'} ${table}: old=${oldCount} new=${newCount}`)
  }
  return { allMatch, results }
}

async function main() {
  console.log(`Migrating data\n  from: ${OLD_URL}\n  to:   ${NEW_URL}\n`)

  for (const table of TABLES) {
    await migrateTable(table)
  }

  const { allMatch, results } = await verifyCounts()

  console.log(
    allMatch
      ? '\nAll tables verified — row counts match between old and new.'
      : '\nMISMATCH DETECTED for: ' + results.filter((r) => !r.match).map((r) => r.table).join(', ')
  )
  if (!allMatch) process.exitCode = 1
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message)
  process.exitCode = 1
})
