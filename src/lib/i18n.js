// Infrastructure only — no strings are translated yet (see the empty
// locale files). Wires up react-i18next so translation can be added
// incrementally later without another setup pass.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from '../locales/en/translation.json'
import fr from '../locales/fr/translation.json'
import es from '../locales/es/translation.json'

// The localStorage key the detector itself reads/writes on every
// i18n.changeLanguage() call (see `detection` below) — named explicitly
// rather than left as the library's default ('i18nextLng') so it reads
// clearly next to this app's other zyndal_-prefixed keys.
export const LANGUAGE_STORAGE_KEY = 'zyndal_language'

// users.language_preference (see api/student/update-settings.js) stores a
// full English word, not an i18next code — that column predates this file
// and already drives AI-generated content language (languageInstruction in
// api/_lib/anthropic.js) for English/French, so its stored values are left
// exactly as they are rather than migrated to codes (no SQL needed, and
// every existing account's value keeps working unchanged). This is the one
// place that maps between the two.
const PREFERENCE_TO_LANGUAGE_CODE = { English: 'en', French: 'fr', Spanish: 'es' }

export function languageCodeForPreference(languagePreference) {
  return PREFERENCE_TO_LANGUAGE_CODE[languagePreference] || 'en'
}

// Intl locale tags for date/number formatting (Intl.toLocaleDateString etc)
// — a distinct concern from the i18next language codes above (which only
// need 'en'/'fr'/'es' to pick a translation resource), so this stays a
// separate map rather than overloading PREFERENCE_TO_LANGUAGE_CODE. fr-CA
// and not fr-FR since Zyndal is a Canadian product.
export const LOCALE_FOR_LANGUAGE = { en: 'en-US', fr: 'fr-CA', es: 'es-ES' }

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'es'],
    // Order matters: a language saved from a previous login wins over the
    // browser's own language, which wins over the 'en' default baked into
    // fallbackLng above.
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false }, // React already escapes output
  })

export default i18n
