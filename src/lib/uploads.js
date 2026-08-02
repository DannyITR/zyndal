// Pure domain logic for the multi-page upload flow, separate from storage.js
// (Supabase I/O) and ai.js (Claude calls).
import i18n, { LOCALE_FOR_LANGUAGE } from './i18n'

export const MAX_UPLOAD_PAGES = 5

export function formatShortDate(dateStr) {
  const locale = LOCALE_FOR_LANGUAGE[i18n.language] || 'en-US'
  return new Date(dateStr).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
