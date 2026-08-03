// One-time bulk generation of French and Spanish curriculum content —
// translates every English curriculum_outlines row and generates a matching
// French/Spanish question pool for every existing English topic in
// generated_questions. See api/_lib/multilingualGeneration.js for the
// actual generation logic (shared with api/admin/generate-multilingual.js).
//
// Requires in .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ANTHROPIC_API_KEY (same vars every other server-side script/endpoint in
// this repo already uses).
//
// Run: node scripts/generate-multilingual-content.js
//
// Idempotent — safe to re-run any time (e.g. after adding new English
// curriculum/questions, or after a partial failure). Already-translated
// outlines and already-generated question pools are skipped.
process.loadEnvFile()

// Deliberately a dynamic import, not a static one: static imports are
// hoisted above this file's own top-level code (including the
// loadEnvFile() call above), and multilingualGeneration.js's own import
// chain reaches api/_lib/auth.js, which builds its Supabase client as a
// side effect of being imported — a static import here would construct
// that client before .env had been loaded at all.
const { runMultilingualGeneration } = await import('../api/_lib/multilingualGeneration.js')

async function main() {
  const startedAt = Date.now()
  const { summary } = await runMultilingualGeneration((message) => console.log(message))
  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1)
  console.log(`\n${summary}`)
  console.log(`Finished in ${elapsedMin} minutes.`)
}

main().catch((err) => {
  console.error('\nMultilingual generation failed:', err)
  process.exitCode = 1
})
