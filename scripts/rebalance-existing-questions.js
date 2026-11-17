// NOT RUN, AND NOT TO BE RUN AS IS: option balancing was scoped to
// upload-based questions only (2026-11-16), so the curriculum bank keeps
// its original options. Kept for reference.
//
// One-off cleanup for the "longest answer is always correct" tell in the
// generated_questions bank (every language). Finds questions whose correct
// option is the longest by more than 25% (see checkOptionBalance in
// api/_lib/optionBalance.js), sends them through the same repair call new
// questions get, and saves the result. A question whose repair still
// doesn't pass the full balance check is deleted rather than kept.
//
// Requires in .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ANTHROPIC_API_KEY.
//
// Run:  node scripts/rebalance-existing-questions.js --dry-run   (count only, no Claude calls, no writes)
//       node scripts/rebalance-existing-questions.js             (repair)
//
// Idempotent: a repaired row passes the check and a deleted row is gone,
// so a re-run only touches what's still flagged. If a repair call itself
// fails (network, credits), that batch is left untouched and counted as
// "failed", for the next run to retry. Repair calls are logged to
// api_usage_log as option-balance-repair:cleanup.
process.loadEnvFile()

// Dynamic imports, after loadEnvFile: api/_lib/auth.js builds its Supabase
// client as soon as it's imported (see generate-multilingual-content.js).
const { supabase } = await import('../api/_lib/auth.js')
const { checkOptionBalance, repairOptions } = await import('../api/_lib/optionBalance.js')

const DRY_RUN = process.argv.includes('--dry-run')
const PAGE_SIZE = 1000
const REPAIR_BATCH_SIZE = 20
const DELAY_MS = 1500

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function loadAllQuestions() {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('generated_questions')
      .select('id, question, options, correct, language')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

async function main() {
  const rows = await loadAllQuestions()
  const flagged = rows.filter((r) => checkOptionBalance(r.options, r.correct).correctTooLong)

  const byLanguage = {}
  for (const r of flagged) byLanguage[r.language] = (byLanguage[r.language] || 0) + 1
  const pct = rows.length ? ((flagged.length / rows.length) * 100).toFixed(1) : '0.0'
  console.log(`Scanned: ${rows.length}`)
  console.log(`Flagged (correct option longest by >25%): ${flagged.length} (${pct}%)  by language: ${JSON.stringify(byLanguage)}`)
  if (DRY_RUN || flagged.length === 0) {
    if (DRY_RUN) console.log('Dry run: nothing repaired or removed.')
    return
  }

  let repaired = 0
  let removed = 0
  let failed = 0
  for (let start = 0; start < flagged.length; start += REPAIR_BATCH_SIZE) {
    const batch = flagged.slice(start, start + REPAIR_BATCH_SIZE)
    let fixes
    try {
      fixes = await repairOptions(
        batch.map((r) => ({ question: r.question, options: r.options, correctIndex: r.correct })),
        { feature: 'option-balance-repair:cleanup' }
      )
    } catch (err) {
      failed += batch.length
      console.error(`  batch ${start / REPAIR_BATCH_SIZE + 1}: repair call failed (${err.code || err.message}); left untouched`)
      if (err.code === 'AI_UNAVAILABLE') break
      await sleep(DELAY_MS)
      continue
    }

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i]
      if (fixes.has(i)) {
        const { error } = await supabase.from('generated_questions').update({ options: fixes.get(i) }).eq('id', row.id)
        if (error) throw error
        repaired++
      } else {
        const { error } = await supabase.from('generated_questions').delete().eq('id', row.id)
        if (error) throw error
        removed++
      }
    }
    console.log(`  batch ${start / REPAIR_BATCH_SIZE + 1}/${Math.ceil(flagged.length / REPAIR_BATCH_SIZE)}: repaired ${repaired}, removed ${removed} so far`)
    await sleep(DELAY_MS)
  }

  console.log(`\nScanned: ${rows.length}`)
  console.log(`Flagged: ${flagged.length}`)
  console.log(`Repaired: ${repaired}`)
  console.log(`Removed: ${removed}`)
  if (failed) console.log(`Failed (left untouched, re-run to retry): ${failed}`)
}

main().catch((err) => {
  console.error('\nRebalance failed:', err)
  process.exitCode = 1
})
