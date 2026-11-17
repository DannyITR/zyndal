// One-off: rebalance the multiple-choice options of upload questions saved
// on 2026-11-16 (America/Toronto), the day the "longest answer is always
// correct" fix shipped (see api/_lib/optionBalance.js). Rows created before
// that day, and generated_questions, are never touched.
//
// Requires in .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ANTHROPIC_API_KEY.
//
// Two steps, so what gets written is exactly what was reviewed:
//   node scripts/rebalance-todays-uploads.js            plan: report + proposed repairs saved to a plan file, NO database writes
//   node scripts/rebalance-todays-uploads.js --apply    write the saved plan (no new Claude calls)
// Options: --plan <path> (default: rebalance-todays-uploads.plan.json in the OS temp folder), --examples <n> (default 5).
//
// Printed vs AI-written: upload_questions has no marker for it. For an upload
// whose original pages are stored (shared uploads), one vision call checks
// each question against the pages. Rows that can't be checked that way are
// left alone. Only flagged AI-written rows are repaired; a repair that
// doesn't pass the balance check removes the row instead. Repair calls are
// logged to api_usage_log as option-balance-repair:todays-uploads.
process.loadEnvFile()

const { readFileSync, writeFileSync } = await import('node:fs')
const { tmpdir } = await import('node:os')
const { join } = await import('node:path')
// Dynamic imports, after loadEnvFile: api/_lib/auth.js builds its Supabase
// client as soon as it's imported (see generate-multilingual-content.js).
const { supabase } = await import('../api/_lib/auth.js')
const { generateJson } = await import('../api/_lib/anthropic.js')
const { checkOptionBalance, repairOptions } = await import('../api/_lib/optionBalance.js')
const { downloadSharedNoteFiles } = await import('../api/_lib/sharedNotesStorage.js')

const SINCE = '2026-11-16T05:00:00Z' // midnight 2026-11-16 in Toronto (EST, UTC-5)
const FEATURE = 'option-balance-repair:todays-uploads'

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const APPLY = process.argv.includes('--apply')
const PLAN_PATH = arg('--plan', join(tmpdir(), 'rebalance-todays-uploads.plan.json'))
const EXAMPLES = Number(arg('--examples', 5))

function correctIndexOf(row) {
  return Array.isArray(row.options) ? row.options.indexOf(row.correct_answer) : -1
}

function isMultipleChoice(row) {
  return Array.isArray(row.options) && row.options.length === 4 && correctIndexOf(row) >= 0
}

// ---------- Printed vs written ----------

const CLASSIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          number: { type: 'integer' },
          printed: { type: 'boolean' },
          evidence: { type: 'string' },
        },
        required: ['number', 'printed', 'evidence'],
      },
    },
  },
  required: ['items'],
}

const CLASSIFY_SYSTEM = `You are given the pages of a student's upload and a numbered list of questions that were saved from it. For each question, decide whether it is PRINTED on the pages as a question (a test, worksheet, exercise or review question that appears on the page, possibly with small wording differences), or was WRITTEN afterwards from the page content (the pages only contain the information, not the question). Notes, headings or facts on the page do not make a question printed; the question itself has to appear on the page. Return JSON: { items: [ { number, printed, evidence } ] }, where evidence quotes the question as it appears on the page if printed, or is an empty string.`

// Map(row id -> 'printed' | 'written'); rows of an upload with no stored
// pages get no entry (unknown).
async function classifyRows(upload, rows) {
  const result = new Map()
  if (!Array.isArray(upload.shared_files) || upload.shared_files.length === 0) return result
  const files = await downloadSharedNoteFiles(upload.shared_files)
  const pages = files.map((f) =>
    f.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.base64 } }
      : { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.base64 } }
  )
  const list = rows.map((r, i) => `${i + 1}. ${r.question}`).join('\n')
  const { items } = await generateJson({
    system: CLASSIFY_SYSTEM,
    schema: CLASSIFY_SCHEMA,
    maxTokens: 300 + rows.length * 120,
    temperature: 0,
    content: [...pages, { type: 'text', text: `Questions:\n${list}` }],
    feature: 'todays-uploads-classify',
  })
  for (const item of items || []) {
    const row = rows[item.number - 1]
    if (row) result.set(row.id, { kind: item.printed ? 'printed' : 'written', evidence: item.evidence })
  }
  return result
}

// ---------- Plan ----------

async function plan() {
  const { data: rows, error } = await supabase
    .from('upload_questions')
    .select('id, upload_id, question, correct_answer, options, explanation, created_at')
    .gte('created_at', SINCE)
    .order('created_at', { ascending: true })
  if (error) throw error

  const uploadIds = [...new Set(rows.map((r) => r.upload_id))]
  const { data: uploads, error: uploadsError } = uploadIds.length
    ? await supabase.from('uploads').select('id, user_id, topic, shared_files').in('id', uploadIds)
    : { data: [] }
  if (uploadsError) throw uploadsError
  const userIds = [...new Set(uploads.map((u) => u.user_id))]
  const { data: users, error: usersError } = userIds.length ? await supabase.from('users').select('id, username').in('id', userIds) : { data: [] }
  if (usersError) throw usersError
  const username = (userId) => users.find((u) => u.id === userId)?.username || '(unknown)'

  console.log(`Window: upload_questions.created_at >= ${SINCE}`)
  console.log(`Rows: ${rows.length}  Uploads: ${uploads.length}`)

  const classification = new Map()
  for (const upload of uploads) {
    const uploadRows = rows.filter((r) => r.upload_id === upload.id)
    const classes = await classifyRows(upload, uploadRows)
    for (const [id, c] of classes) classification.set(id, c)
    const counts = { printed: 0, written: 0, unknown: 0 }
    for (const r of uploadRows) counts[classes.get(r.id)?.kind || 'unknown']++
    console.log(`\n  upload ${upload.id} "${upload.topic}" owner=${username(upload.user_id)} rows=${uploadRows.length}`)
    console.log(`    printed ${counts.printed}, AI-written ${counts.written}, unknown (no stored pages; left alone) ${counts.unknown}`)
    for (const r of uploadRows) {
      const c = classes.get(r.id)
      if (c?.kind === 'printed') console.log(`    printed: "${r.question}"  (on page: "${c.evidence}")`)
    }
  }

  const flagged = rows.filter((r) => isMultipleChoice(r) && !checkOptionBalance(r.options, correctIndexOf(r)).ok)
  const toRepair = flagged.filter((r) => classification.get(r.id)?.kind === 'written')
  console.log(`\nFlagged by the balance check: ${flagged.length} of ${rows.filter(isMultipleChoice).length} multiple-choice rows`)
  console.log(`  AI-written (will be repaired): ${toRepair.length}`)
  console.log(`  printed or unknown (left alone): ${flagged.length - toRepair.length}`)

  const fixes = toRepair.length
    ? await repairOptions(
        toRepair.map((r) => ({ question: r.question, options: r.options, correctIndex: correctIndexOf(r) })),
        { feature: FEATURE }
      )
    : new Map()

  const entries = toRepair.map((r, i) => {
    const options = fixes.get(i) || null
    const ci = correctIndexOf(r)
    return {
      id: r.id,
      question: r.question,
      explanation: r.explanation,
      before: { options: r.options, correct_answer: r.correct_answer },
      after: options ? { options, correct_answer: options[ci] } : null,
    }
  })
  writeFileSync(PLAN_PATH, JSON.stringify({ since: SINCE, scanned: rows.length, flagged: flagged.length, entries }, null, 2))

  const repaired = entries.filter((e) => e.after).length
  console.log(`\nPlanned: repair ${repaired}, remove ${entries.length - repaired} (repair didn't pass the check)`)
  console.log(`Plan saved to ${PLAN_PATH}. Nothing was written to the database.`)

  console.log(`\n---------- ${Math.min(EXAMPLES, repaired)} before/after examples ----------`)
  for (const e of entries.filter((x) => x.after).slice(0, EXAMPLES)) {
    console.log(`\nQ: ${e.question}`)
    console.log(`   explanation: ${e.explanation || '(none)'}`)
    console.log('   before:')
    for (const o of e.before.options) console.log(`     ${o === e.before.correct_answer ? '*' : ' '} [${o.length}] ${o}`)
    console.log('   after:')
    for (const o of e.after.options) console.log(`     ${o === e.after.correct_answer ? '*' : ' '} [${o.length}] ${o}`)
  }
}

// ---------- Apply ----------

function sameRow(row, before) {
  return row && row.correct_answer === before.correct_answer && JSON.stringify(row.options) === JSON.stringify(before.options)
}

async function apply() {
  const saved = JSON.parse(readFileSync(PLAN_PATH, 'utf8'))
  let repaired = 0
  let removed = 0
  let skipped = 0
  for (const entry of saved.entries) {
    const { data: row, error } = await supabase.from('upload_questions').select('id, options, correct_answer, created_at').eq('id', entry.id).maybeSingle()
    if (error) throw error
    // Changed or deleted since the plan was made, or outside the window:
    // leave it alone rather than overwrite something nobody reviewed.
    if (!sameRow(row, entry.before) || row.created_at < saved.since) {
      skipped++
      continue
    }
    if (entry.after) {
      const { error: updateError } = await supabase.from('upload_questions').update(entry.after).eq('id', entry.id)
      if (updateError) throw updateError
      repaired++
    } else {
      const { error: deleteError } = await supabase.from('upload_questions').delete().eq('id', entry.id)
      if (deleteError) throw deleteError
      removed++
    }
  }
  console.log(`Scanned: ${saved.scanned}`)
  console.log(`Flagged: ${saved.flagged}`)
  console.log(`Repaired: ${repaired}`)
  console.log(`Removed: ${removed}`)
  if (skipped) console.log(`Skipped (changed since the plan was made): ${skipped}`)
}

;(APPLY ? apply() : plan()).catch((err) => {
  console.error('\nFailed:', err)
  process.exitCode = 1
})
