// Shared core for the one-time French/Spanish content generation — used by
// both scripts/generate-multilingual-content.js (run manually via `node`)
// and api/admin/generate-multilingual.js (triggered from the admin panel).
// Kept out of both of those files so the actual generation logic exists in
// exactly one place. `log` is injected so each caller can format progress
// its own way (console.log for the script, a collected array of lines for
// the HTTP endpoint's JSON response) without this file caring which.
import { supabase } from './auth.js'
import { generateCurriculumOutlineData, translateCurriculumOutlineData } from '../generate-curriculum.js'
import { generateQuestionPoolIfMissing } from '../questions/generate-question-pool.js'
import { SUBJECTS } from '../../src/lib/questions.js'

// Matches sanitizeGrade's "7-11" range (api/_lib/sanitize.js) — the only
// grades this app's curriculum/question generation ever targets.
const GRADES = [7, 8, 9, 10, 11]

const TARGET_LANGUAGES = [
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
]

// A one-time bulk job, not latency-sensitive — erring toward a slower,
// safer pace between Anthropic calls costs nothing and avoids rate limits
// across the ~180+ calls a full run makes (30 outlines x 2 languages, plus
// every topic combination x 2 languages x 20 questions each).
const CALL_DELAY_MS = 1500

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Simple elapsed-time-based ETA — accurate enough for a progress readout on
// a one-time job, not trying to be smarter than that (e.g. skipped steps
// are near-instant and generated ones take several seconds; averaging
// across both is good enough once a handful of steps have run).
function createProgressTracker(totalSteps, log) {
  let done = 0
  const start = Date.now()
  return function step(message) {
    done++
    const avgMs = (Date.now() - start) / done
    const etaMin = Math.max(0, Math.round((avgMs * (totalSteps - done)) / 60000))
    log(`[${done}/${totalSteps}] ${message}${done < totalSteps ? ` (ETA ~${etaMin}m remaining)` : ''}`)
  }
}

async function fetchEnglishOutline(subject, grade) {
  const { data, error } = await supabase
    .from('curriculum_outlines')
    .select('outline_data')
    .eq('subject', subject)
    .eq('grade', grade)
    .eq('language', 'en')
    .maybeSingle()
  if (error) throw error
  return data?.outline_data ?? null
}

async function outlineExists(subject, grade, language) {
  const { count, error } = await supabase
    .from('curriculum_outlines')
    .select('id', { count: 'exact', head: true })
    .eq('subject', subject)
    .eq('grade', grade)
    .eq('language', language)
  if (error) throw error
  return (count || 0) > 0
}

// Processes all 30 subject+grade combinations x 2 target languages (60
// steps). Bootstraps a missing English outline first (rare — only relevant
// for a subject/grade combo no student has ever opened yet), since
// translation needs an English source to translate from.
export async function translateOutlines(log) {
  const step = createProgressTracker(SUBJECTS.length * GRADES.length * TARGET_LANGUAGES.length, log)
  let translated = 0
  let skipped = 0

  for (const subject of SUBJECTS) {
    for (const grade of GRADES) {
      let englishOutline = await fetchEnglishOutline(subject.id, grade)
      if (!englishOutline) {
        log(`Generating English outline for ${subject.name} Grade ${grade} (no source to translate from yet)...`)
        englishOutline = await generateCurriculumOutlineData(subject.name, grade)
        const { error: insertError } = await supabase
          .from('curriculum_outlines')
          .insert({ subject: subject.id, grade, outline_data: englishOutline, language: 'en' })
        if (insertError && insertError.code !== '23505') throw insertError
        await sleep(CALL_DELAY_MS)
      }

      for (const target of TARGET_LANGUAGES) {
        if (await outlineExists(subject.id, grade, target.code)) {
          skipped++
          step(`${subject.name} Grade ${grade} to ${target.name} — already exists, skipping`)
          continue
        }

        const translatedOutline = await translateCurriculumOutlineData(englishOutline, target.name)
        const { error: insertError } = await supabase
          .from('curriculum_outlines')
          .insert({ subject: subject.id, grade, outline_data: translatedOutline, language: target.code })
        if (insertError && insertError.code !== '23505') throw insertError
        translated++
        step(`Translating ${subject.name} Grade ${grade} to ${target.name}... done`)
        await sleep(CALL_DELAY_MS)
      }
    }
  }

  return { translated, skipped }
}

// Every unique subject+grade+unit_number+topic_title combination that
// already has an English question pool — the source list for what to
// generate French/Spanish pools for. unit_title/topic_title are kept in
// English in the generated rows too (only question/options/explanation
// content is translated) — daily-question serving (getPool in
// api/_lib/dailyQuestion.js) only ever filters generated_questions by
// subject/grade/language/unit_number, never topic_title, so this has no
// effect on serving correctness and keeps the idempotency key identical to
// the English source row it's derived from.
async function fetchEnglishTopicCombos() {
  const { data, error } = await supabase
    .from('generated_questions')
    .select('subject, grade, unit_number, unit_title, topic_title')
    .eq('language', 'en')
  if (error) throw error

  const seen = new Map()
  for (const row of data || []) {
    const key = `${row.subject}::${row.grade}::${row.unit_number}::${row.topic_title}`
    if (!seen.has(key)) seen.set(key, row)
  }
  return [...seen.values()]
}

export async function generateQuestionBanks(log) {
  const combos = await fetchEnglishTopicCombos()
  const step = createProgressTracker(Math.max(combos.length * TARGET_LANGUAGES.length, 1), log)
  let generated = 0
  let skipped = 0
  let failed = 0

  for (const combo of combos) {
    for (const target of TARGET_LANGUAGES) {
      // A single combo occasionally fails validation twice in a row inside
      // generateQuestionPoolIfMissing (the model miscounting questions/
      // options — see that function's own comment) and throws. Catching
      // per-combo rather than letting it abort the whole run matters a lot
      // here specifically: this loop makes 100+ calls, each taking a while,
      // so one rare miss shouldn't cost all the progress made before it —
      // the run stays idempotent either way (a later re-run retries
      // whatever's still missing, including anything that failed here).
      try {
        const result = await generateQuestionPoolIfMissing({
          subject: combo.subject,
          grade: combo.grade,
          unit_number: combo.unit_number,
          unit_title: combo.unit_title,
          topic_title: combo.topic_title,
          language: target.code,
        })
        if (result.skipped) {
          skipped++
          step(`${combo.subject} Grade ${combo.grade} Unit ${combo.unit_number} "${combo.topic_title}" (${target.name}) — already exists, skipping`)
        } else {
          generated++
          step(`Generating ${combo.subject} Grade ${combo.grade} Unit ${combo.unit_number} "${combo.topic_title}" in ${target.name}... done`)
        }
      } catch (err) {
        failed++
        step(`${combo.subject} Grade ${combo.grade} Unit ${combo.unit_number} "${combo.topic_title}" (${target.name}) — FAILED: ${err.message} (will retry on next run)`)
      }
      await sleep(CALL_DELAY_MS)
    }
  }

  return { generated, skipped, failed, comboCount: combos.length }
}

// The single entry point both the CLI script and the admin endpoint call.
// Idempotent end to end — safe to re-run after a partial failure or just to
// pick up newly-added English content.
export async function runMultilingualGeneration(log = console.log) {
  log('Starting multilingual content generation...')

  log('\nStep 1/2: Curriculum outlines (French + Spanish)')
  const outlines = await translateOutlines(log)

  log('\nStep 2/2: Question banks (French + Spanish)')
  const questions = await generateQuestionBanks(log)

  const summary =
    `Generated ${outlines.translated} curriculum outlines, ${questions.generated} question sets in FR and ES ` +
    `(${outlines.skipped} outlines and ${questions.skipped} question sets already existed and were skipped` +
    (questions.failed ? `; ${questions.failed} question set(s) failed and will be retried on the next run` : '') +
    `).`
  log(`\n${summary}`)

  return { outlines, questions, summary }
}
