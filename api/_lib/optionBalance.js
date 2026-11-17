// Guards against the "longest answer is always correct" tell in
// AI-written multiple-choice questions. Two layers:
//
// 1. OPTION_RULES, appended to every prompt that writes options.
// 2. A check after generation (checkOptionBalance). Flagged questions get
//    one cheap repair call (repairOptions) that writes candidate wrong
//    options near a target length, plus a condensed version of the correct
//    answer; the code picks a set that passes. The correct answer keeps its
//    position and meaning, and its original wording whenever that can be
//    balanced. Anything still unbalanced after the repair is dropped
//    rather than shown.
//
// Used by every generator that writes options (see balanceIndexedQuestions
// / balanceAnswerQuestions) and by scripts/rebalance-existing-questions.js.
import { generateJson } from './anthropic.js'

export const OPTION_RULES = `Rules for multiple-choice options:
- All four options must be similar in length and structure: within about 20% of each other in characters, and in the same grammatical form.
- The correct answer must NOT be the longest or the most detailed option. Make the wrong options just as specific and plausible, based on common student mistakes.
- Vary the position of the correct answer across A, B, C and D.
- Don't put qualifiers like "always", "never" or "only" in the wrong options alone.`

const CORRECT_LONGEST_RATIO = 1.25
const SPREAD_RATIO = 2
// Very short options ("5" vs "12", "H2O" vs "NaCl") can break a ratio with
// no real tell and nothing a rewrite could fix, so a ratio only counts once
// the gap is also more than this many characters.
const MIN_GAP_CHARS = 8

const REPAIR_BATCH_SIZE = 20

function optionLengths(options) {
  return options.map((o) => String(o ?? '').trim().length)
}

// applicable: false for anything that isn't 4 options with a valid correct
// index (short-answer questions, printed questions with other counts),
// which this check leaves alone.
export function checkOptionBalance(options, correctIndex) {
  if (!Array.isArray(options) || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    return { applicable: false, ok: true }
  }
  const lengths = optionLengths(options)
  const correctLength = lengths[correctIndex]
  const longestWrong = Math.max(...lengths.filter((_, i) => i !== correctIndex))
  const longest = Math.max(...lengths)
  const shortest = Math.min(...lengths)
  const correctTooLong = correctLength > longestWrong * CORRECT_LONGEST_RATIO && correctLength - longestWrong > MIN_GAP_CHARS
  const spreadTooWide = longest > shortest * SPREAD_RATIO && longest - shortest > MIN_GAP_CHARS
  return { applicable: true, ok: !correctTooLong && !spreadTooWide, correctTooLong, spreadTooWide }
}

const CANDIDATES = 6

const REPAIR_SCHEMA = {
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
          correct_condensed: { type: 'string' },
          wrong_answers: { type: 'array', items: { type: 'string' } },
        },
        required: ['number', 'correct_condensed', 'wrong_answers'],
      },
    },
  },
  required: ['items'],
}

// What the model is asked for, and why (each step measured on samples of
// 20-40 flagged generated_questions rows):
// - Rewrite the three wrong options to a character range: 1 in 20 passed.
//   Haiku can't count characters, and it anchored on the old short options.
// - So it writes six wrong-answer candidates plus a condensed version of the
//   correct answer (same meaning), with targets in WORDS, which it hits far
//   better, and without seeing the old wrong options. pickBalancedSet below
//   then makes the length decision in code: 37-38 in 40 passed.
// The original correct wording is kept whenever a set balances with it
// without being the longest/shortest option; otherwise the condensed one
// is used (typical for a long, explanation-style correct answer).
const REPAIR_SYSTEM = `You rewrite the options of multiple-choice questions so that their length doesn't give the answer away. For each numbered question you get the question, the correct answer, and a target word count. Write:

1. "correct_condensed": the correct answer reworded to AT MOST the target word count, with exactly the same meaning and facts, still fully and clearly correct, and still a natural, grammatical phrase (don't drop articles or connecting words). Cut filler words and secondary details first. If it is already within the target, repeat it unchanged.

2. "wrong_answers": ${CANDIDATES} wrong answers, each with a word count between the target and 3 words more (count the words). Build them mainly by expanding the current wrong answers you're given, adding specific detail that keeps them wrong; only write a new one if needed. They must:
- be definitely FALSE for this question. If a statement could be true or partly true (e.g. another real way to get the same result), don't use it;
- have the same level of detail and the same grammatical form as the correct answer;
- be plausible, based on common student mistakes, and just as specific as the correct answer;
- differ from each other and never repeat or paraphrase the correct answer;
- not rely on absolute qualifiers ("always", "never", "only", "exclusively", "completely", or the same words in other languages); remove them when expanding a current wrong answer;
- be in the same language as the question.

Return JSON: { items: [ { number, correct_condensed, wrong_answers: [${CANDIDATES} strings] } ] }, one item per question.`

function wordCount(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length
}

// Halfway (in words) between the correct answer and the wrong options'
// median: wrong answers stretch up, a long correct answer condenses down,
// so neither has to travel the whole distance.
function targetWords(item) {
  const counts = item.options.map(wordCount)
  const wrong = counts.filter((_, j) => j !== item.correctIndex).sort((a, b) => a - b)
  return Math.max(1, Math.round((counts[item.correctIndex] + wrong[1]) / 2))
}

function renderRepairItems(items) {
  return items
    .map((item, i) => {
      const correct = String(item.options[item.correctIndex]).trim()
      const wrong = item.options.filter((_, j) => j !== item.correctIndex).join(' | ')
      return `${i + 1}. ${item.question}\n   Correct answer (${wordCount(correct)} words): ${correct}\n   Current wrong answers: ${wrong}\n   Target: ${targetWords(item)} words`
    })
    .join('\n\n')
}

// Absolute qualifiers that mark an option as the wrong one when only wrong
// options carry them (EN/FR/ES, the app's languages). The prompt asks the
// model to avoid them; pickBalancedSet also scores against them, since the
// model still keeps them now and then when expanding an old wrong answer.
const QUALIFIER_PATTERN = /(?<!\p{L})(always|never|only|exclusively|completely|toujours|jamais|seulement|uniquement|exclusivement|complètement|siempre|nunca|solo|sólo|solamente|únicamente|exclusivamente|completamente)(?!\p{L})/iu

function hasQualifier(text) {
  return QUALIFIER_PATTERN.test(String(text ?? ''))
}

// Every 3-of-n combination of the candidates.
function triples(list) {
  const out = []
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) for (let c = b + 1; c < list.length; c++) out.push([list[a], list[b], list[c]])
  return out
}

// Of the candidate sets that pass checkOptionBalance (correct option kept
// at its position), returns the lowest-scoring { options, score }, or null
// if none passes. Score, worst first: each wrong option carrying an
// absolute qualifier the correct one doesn't (20), the correct option
// being the longest or the shortest (10; always-shortest would be a tell
// of its own), then the spread between longest and shortest (under ~1).
function pickBalancedSet(item, correct, candidates) {
  const correctLength = String(correct).trim().length
  const correctQualified = hasQualifier(correct)
  let best = null
  for (const trio of triples(candidates)) {
    const options = []
    let k = 0
    for (let j = 0; j < 4; j++) options.push(j === item.correctIndex ? correct : trio[k++])
    if (!checkOptionBalance(options, item.correctIndex).ok) continue
    const lengths = optionLengths(options)
    const qualifiers = correctQualified ? 0 : trio.filter(hasQualifier).length
    const extreme = correctLength === Math.max(...lengths) || correctLength === Math.min(...lengths) ? 1 : 0
    const spread = (Math.max(...lengths) - Math.min(...lengths)) / Math.max(1, correctLength)
    const score = qualifiers * 20 + extreme * 10 + spread
    if (!best || score < best.score) best = { options, score }
  }
  return best
}

async function repairBatch(items, feature) {
  const { items: fixed } = await generateJson({
    system: REPAIR_SYSTEM,
    schema: REPAIR_SCHEMA,
    maxTokens: 300 + items.length * 600,
    temperature: 0,
    content: renderRepairItems(items),
    feature,
  })
  const out = new Map()
  for (const entry of fixed || []) {
    const index = entry.number - 1
    const item = items[index]
    if (!item || !Array.isArray(entry.wrong_answers)) continue
    const original = item.options[item.correctIndex]
    const condensed = String(entry.correct_condensed || '').trim()
    const notCorrect = (w) => w && w.toLowerCase() !== String(original).trim().toLowerCase() && w.toLowerCase() !== condensed.toLowerCase()
    const candidates = [...new Set(entry.wrong_answers.map((w) => String(w).trim()).filter(notCorrect))]
    if (candidates.length < 3) continue
    // The original wording wins unless only the condensed one balances, or
    // the condensed one is clearly better (it avoids a qualifier or
    // longest/shortest penalty, or tightens the spread by more than half).
    const withOriginal = pickBalancedSet(item, original, candidates)
    const withCondensed = condensed && condensed !== String(original).trim() ? pickBalancedSet(item, condensed, candidates) : null
    const useCondensed = withCondensed && (!withOriginal || withCondensed.score + 0.5 < withOriginal.score)
    const best = useCondensed ? withCondensed : withOriginal
    if (best) out.set(index, best.options)
  }
  return out
}

// items: [{ question, options, correctIndex }]. Returns Map(item index ->
// repaired options) holding only repairs that pass checkOptionBalance. The
// correct option stays at correctIndex, but its wording may be the
// condensed version, so callers storing the answer text must take it from
// options[correctIndex].
// Throws if a repair call fails, so the caller decides what that means.
export async function repairOptions(items, { feature = 'option-balance-repair' } = {}) {
  const repaired = new Map()
  for (let start = 0; start < items.length; start += REPAIR_BATCH_SIZE) {
    const batch = items.slice(start, start + REPAIR_BATCH_SIZE)
    const result = await repairBatch(batch, feature)
    for (const [i, options] of result) repaired.set(start + i, options)
  }
  return repaired
}

// Shared core: flag, repair once, keep what passes, drop the rest.
async function balance(questions, { source, correctIndexOf, applyRepair }) {
  const list = Array.isArray(questions) ? questions : []
  const flagged = []
  list.forEach((q, i) => {
    if (!checkOptionBalance(q.options, correctIndexOf(q)).ok) flagged.push(i)
  })
  if (flagged.length === 0) return list

  let repaired = new Map()
  try {
    repaired = await repairOptions(
      flagged.map((i) => ({ question: list[i].question, options: list[i].options, correctIndex: correctIndexOf(list[i]) })),
      { feature: `option-balance-repair:${source}` }
    )
  } catch (err) {
    console.error(`[optionBalance] repair call failed for ${source}; dropping ${flagged.length} flagged question(s):`, err.message)
  }

  const dropped = new Set()
  const out = [...list]
  flagged.forEach((qi, k) => {
    if (repaired.has(k)) out[qi] = applyRepair(out[qi], repaired.get(k), correctIndexOf(out[qi]))
    else dropped.add(qi)
  })
  console.log(`[optionBalance] ${source}: ${list.length} questions, ${flagged.length} flagged, ${flagged.length - dropped.size} repaired, ${dropped.size} dropped`)
  return out.filter((_, i) => !dropped.has(i))
}

// Questions shaped { question, options, correct } (0-based index).
export function balanceIndexedQuestions(questions, { source }) {
  return balance(questions, { source, correctIndexOf: (q) => q.correct, applyRepair: (q, options) => ({ ...q, options }) })
}

// Questions shaped { question, options, correct_answer } (answer text).
// skip(q) leaves a question untouched, e.g. one printed on the student's
// page, whose options have to match the paper.
export function balanceAnswerQuestions(questions, { source, skip = () => false }) {
  return balance(questions, {
    source,
    correctIndexOf: (q) => (skip(q) || !Array.isArray(q.options) ? -1 : q.options.indexOf(q.correct_answer)),
    applyRepair: (q, options, correctIndex) => ({ ...q, options, correct_answer: options[correctIndex] }),
  })
}
