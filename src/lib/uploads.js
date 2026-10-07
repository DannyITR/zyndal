// Pure domain logic for the multi-page upload flow, separate from storage.js
// (Supabase I/O) and ai.js (Claude calls). Deliberately not importing from
// src/lib/i18n.js here (browser-only — pulls in react-i18next and
// i18next-browser-languagedetector) even though no serverless function
// currently imports this file — see src/lib/streak.js's header comment for
// why that exact pattern took down every API route that reached it.
import { getActiveLanguage } from './streak.js'

export const MAX_UPLOAD_PAGES = 5

const LOCALE_FOR_LANGUAGE = { en: 'en-US', fr: 'fr-CA', es: 'es-ES' }

export function formatShortDate(dateStr) {
  const locale = LOCALE_FOR_LANGUAGE[getActiveLanguage()] || 'en-US'
  return new Date(dateStr).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
