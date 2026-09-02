// Basic wordlist filter for forum posts/replies (api/forum/create-thread.js,
// api/forum/create-reply.js, and the client-side NewThreadModal/reply box
// for instant feedback before ever hitting the network). Deliberately not
// exhaustive or multilingual-complete -- "basic" per spec -- just common
// English/French profanity, checked as whole words so it doesn't flag
// innocuous substrings (e.g. "class", "assignment"). Wordlist entries are
// unaccented; input text has its own accents stripped before matching (see
// stripAccents) so accented and unaccented spellings both match without
// needing every accent variant listed, and so JS's ASCII-only \w in \b
// doesn't silently fail to find a boundary right after an accented letter.
const WORDLIST = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'piss',
  'douche', 'slut', 'whore', 'fag', 'faggot', 'nigger', 'nigga', 'retard',
  'motherfucker', 'dumbass', 'jackass', 'twat', 'wanker', 'prick', 'cock',
  'merde', 'putain', 'connard', 'connasse', 'salope', 'encule', 'batard',
  'con', 'pute', 'foutre',
]

const WORD_PATTERN = new RegExp(`\\b(${WORDLIST.join('|')})\\b`, 'i')
const COMBINING_DIACRITICS = new RegExp('[̀-ͯ]', 'g')

function stripAccents(text) {
  return text.normalize('NFD').replace(COMBINING_DIACRITICS, '')
}

export function containsProfanity(text) {
  if (!text) return false
  return WORD_PATTERN.test(stripAccents(text))
}
