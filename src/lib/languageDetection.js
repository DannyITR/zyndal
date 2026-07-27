// Simple, dependency-free English/French detection for a block of text (an
// upload's summary + key_concepts) — used to make AI-generated questions
// match the language of the source material instead of silently defaulting
// to English (or guessing off the subject name, which broke for e.g. an
// English-language worksheet uploaded under the French subject).

const FRENCH_INDICATOR_WORDS = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'et',
  'est',
  'avec',
  'pour',
  'dans',
  'que',
  'qui',
  'sur',
  'par',
])

const FRENCH_INDICATOR_RATIO_THRESHOLD = 0.2

export function detectLanguage(text) {
  if (!text) return 'English'
  const words = text.toLowerCase().match(/[a-zà-ÿ]+/g)
  if (!words || words.length === 0) return 'English'

  const frenchIndicatorCount = words.filter((word) => FRENCH_INDICATOR_WORDS.has(word)).length
  const ratio = frenchIndicatorCount / words.length
  return ratio > FRENCH_INDICATOR_RATIO_THRESHOLD ? 'French' : 'English'
}

// Combines an upload's summary and key_concepts (or several uploads' worth)
// into one sample for detectLanguage — a single short field is often too
// short to classify reliably on its own.
export function detectLanguageFromContent(summary, keyConcepts) {
  const combined = [summary, ...(keyConcepts || [])].filter(Boolean).join(' ')
  return detectLanguage(combined)
}
